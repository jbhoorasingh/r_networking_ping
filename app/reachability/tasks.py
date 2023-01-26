from time import sleep
from django.core.mail import send_mail
from celery import shared_task
from .models import Host, Test
from icmplib import ping, exceptions


@shared_task()
def poll():
    active_hosts = Host.objects.filter(active=True).all()
    for host in active_hosts:
        ping_host.delay(host.id)
    return {
        'status': True,
        'hosts': len(active_hosts),
    }


@shared_task()
def ping_host(host_id):
    """Ping host and update database"""
    host = Host.objects.get(id=host_id)
    try:
        resp = ping(host.ip_address, count=4, interval=0.2, timeout=2, privileged=True)

    except exceptions.SocketPermissionError:
        msg = "Could not ping {} - {}".format(host.ip_address, "SocketPermissionError")
        print(msg)
        return {
            'status': False,
            'host': '{} ({})'.format(host.hostname, host.ip_address),
            'msg': msg
        }
    except Exception as e:
        msg = "Could not ping {} - {}".format(host.ip_address, str(e))
        print(msg)
        return {
            'status': False,
            'host': '{} ({})'.format(host.hostname, host.ip_address),
            'msg': msg
        }

    host_test = Test(host=host,
                     avg_rtt=resp.avg_rtt,
                     min_rtt=resp.max_rtt,
                     max_rtt=resp.max_rtt,
                     packets_sent=resp.packets_sent,
                     packets_received=resp.packets_received,
                     packet_loss=resp.packet_loss,
                     is_alive=resp.is_alive
                     )

    host_test.save()
    return {
        'status': True,
        'host': '{} ({})'.format(host.hostname, host.ip_address),
        'test': host_test.id
    }
