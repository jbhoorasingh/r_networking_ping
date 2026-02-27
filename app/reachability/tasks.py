import os
import shutil
import subprocess
from celery import shared_task
from celery.utils.log import get_task_logger
from .models import Host, Test
from icmplib import ping, traceroute, exceptions

logger = get_task_logger(__name__)


def _env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _format_trace_output(trace_hops):
    if not trace_hops:
        return "No hops returned."

    lines = []
    for hop in trace_hops:
        distance = getattr(hop, "distance", "?")
        address = getattr(hop, "address", None) or "*"
        avg_rtt = getattr(hop, "avg_rtt", None)
        if isinstance(avg_rtt, (int, float)):
            line = f"{distance}. {address} ({avg_rtt:.2f} ms)"
        else:
            line = f"{distance}. {address}"
        lines.append(line)
    return "\n".join(lines)


def _run_system_traceroute(address):
    if os.name == "nt":
        trace_bin = shutil.which("tracert")
        if not trace_bin:
            return True, "Traceroute unavailable: 'tracert' command not found."
        cmd = [trace_bin, "-d", "-h", "12", "-w", "1000", address]
    else:
        trace_bin = shutil.which("traceroute")
        if not trace_bin:
            return True, "Traceroute unavailable: 'traceroute' command not found."
        cmd = [trace_bin, "-n", "-m", "12", "-q", "1", "-w", "1", address]

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return True, "Traceroute command timed out."
    except Exception as exc:
        return True, f"Traceroute command failed: {exc}"

    output = (completed.stdout or "").strip()
    error = (completed.stderr or "").strip()
    if error:
        output = f"{output}\n{error}".strip()
    if not output:
        output = f"Traceroute command returned no output (exit={completed.returncode})."
    if len(output) > 12000:
        output = f"{output[:12000]}\n... output truncated ..."
    return True, output


def _run_traceroute(host, privileged_ping):
    trace_privileged = _env_bool("TRACEROUTE_PRIVILEGED", default=privileged_ping)
    fallback_enabled = _env_bool("TRACEROUTE_SYSTEM_FALLBACK", default=True)
    try:
        trace_hops = traceroute(host.ip_address, timeout=2, privileged=trace_privileged)
        return True, _format_trace_output(trace_hops)
    except exceptions.SocketPermissionError as exc:
        if fallback_enabled:
            logger.info(
                "icmplib traceroute needs elevated privileges for host=%s; using system traceroute fallback",
                host.id,
            )
            return _run_system_traceroute(host.ip_address)
        return True, f"Traceroute failed: {exc}"
    except Exception as exc:
        return True, f"Traceroute failed: {exc}"


def _save_failed_test(host, trace_attempted=False, trace_output=""):
    """Persist failed probe so the UI/history still shows an attempt."""
    return Test.objects.create(
        host=host,
        avg_rtt=0.0,
        min_rtt=0.0,
        max_rtt=0.0,
        packets_sent=0,
        packets_received=0,
        packet_loss=100.0,
        is_alive=False,
        trace_attempted=trace_attempted,
        trace_output=trace_output,
    )


@shared_task()
def poll():
    active_hosts = Host.objects.filter(active=True).all()
    logger.info("poll started with %s active hosts", len(active_hosts))
    dispatch_async = _env_bool("PING_DISPATCH_ASYNC", default=False)
    for host in active_hosts:
        if dispatch_async:
            async_result = ping_host.delay(host.id)
            logger.info(
                "poll queued ping_host task=%s for host=%s (%s)",
                async_result.id,
                host.id,
                host.ip_address,
            )
            continue

        result = ping_host(host.id)
        logger.info(
            "poll inline ping_host host=%s status=%s test=%s",
            host.id,
            result.get("status"),
            result.get("test"),
        )
    return {
        'status': True,
        'hosts': len(active_hosts),
    }


@shared_task()
def ping_host(host_id):
    """Ping host and update database"""
    try:
        host = Host.objects.get(id=host_id)
    except Host.DoesNotExist:
        msg = f"host does not exist: {host_id}"
        logger.warning(msg)
        return {
            "status": False,
            "host": str(host_id),
            "msg": msg,
        }

    privileged_ping = _env_bool("PING_PRIVILEGED", default=False)
    trace_always = host.trace_mode == Host.TRACE_MODE_ALWAYS
    trace_on_fail = host.trace_mode == Host.TRACE_MODE_ON_FAIL
    trace_attempted = False
    trace_output = ""
    try:
        resp = ping(
            host.ip_address,
            count=4,
            interval=0.2,
            timeout=2,
            privileged=privileged_ping,
        )

        if trace_always:
            trace_attempted, trace_output = _run_traceroute(host, privileged_ping)

    except exceptions.SocketPermissionError:
        msg = "Could not ping {} - {}".format(host.ip_address, "SocketPermissionError")
        if trace_always or trace_on_fail:
            trace_attempted, trace_output = _run_traceroute(host, privileged_ping)
        failed_test = _save_failed_test(
            host,
            trace_attempted=trace_attempted,
            trace_output=trace_output,
        )
        logger.warning("%s (saved failed test=%s)", msg, failed_test.id)
        return {
            'status': False,
            'host': '{} ({})'.format(host.hostname, host.ip_address),
            'msg': msg,
            'test': failed_test.id,
            'trace_attempted': trace_attempted,
        }
    except Exception as e:
        msg = "Could not ping {} - {}".format(host.ip_address, str(e))
        if trace_always or trace_on_fail:
            trace_attempted, trace_output = _run_traceroute(host, privileged_ping)
        failed_test = _save_failed_test(
            host,
            trace_attempted=trace_attempted,
            trace_output=trace_output,
        )
        logger.warning("%s (saved failed test=%s)", msg, failed_test.id)
        return {
            'status': False,
            'host': '{} ({})'.format(host.hostname, host.ip_address),
            'msg': msg,
            'test': failed_test.id,
            'trace_attempted': trace_attempted,
        }

    host_test = Test(host=host,
                     avg_rtt=resp.avg_rtt,
                     min_rtt=resp.min_rtt,
                     max_rtt=resp.max_rtt,
                     packets_sent=resp.packets_sent,
                     packets_received=resp.packets_received,
                     packet_loss=resp.packet_loss,
                     is_alive=resp.is_alive,
                     trace_attempted=trace_attempted,
                     trace_output=trace_output,
                     )

    host_test.save()
    logger.info(
        "ping_host saved test=%s host=%s alive=%s avg_rtt=%s",
        host_test.id,
        host.id,
        host_test.is_alive,
        host_test.avg_rtt,
    )
    return {
        'status': True,
        'host': '{} ({})'.format(host.hostname, host.ip_address),
        'test': host_test.id,
        'trace_attempted': trace_attempted,
    }
