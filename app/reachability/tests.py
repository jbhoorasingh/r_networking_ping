import json
import os
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase

from .models import Host, Test
from .tasks import ping_host, poll, _run_traceroute
from icmplib import exceptions


class ReachabilityApiTests(TestCase):
    def test_host_list_handles_host_without_tests(self):
        Host.objects.create(hostname="router-a", ip_address="192.168.1.1", active=True)

        response = self.client.get("/api/host/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertIsNone(payload[0]["avg_rtt"])
        self.assertIsNone(payload[0]["is_alive"])

    def test_test_list_includes_host_metadata(self):
        host = Host.objects.create(hostname="router-b", ip_address="10.0.0.5", active=True)
        Test.objects.create(
            host=host,
            avg_rtt=8.5,
            min_rtt=5.2,
            max_rtt=11.1,
            packets_sent=4,
            packets_received=4,
            packet_loss=0.0,
            is_alive=True,
        )

        response = self.client.get("/api/test/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["host_name"], "router-b")
        self.assertEqual(payload[0]["host_ip"], "10.0.0.5")

    def test_host_test_list_limit_query_param(self):
        host = Host.objects.create(hostname="router-c", ip_address="10.0.0.6", active=True)
        for avg in [2.0, 3.0, 4.0]:
            Test.objects.create(
                host=host,
                avg_rtt=avg,
                min_rtt=avg,
                max_rtt=avg,
                packets_sent=4,
                packets_received=4,
                packet_loss=0.0,
                is_alive=True,
            )

        response = self.client.get(f"/api/host/{host.id}/test?limit=2")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 2)

    def test_host_crud_flow(self):
        create_resp = self.client.post(
            "/api/host/",
            data=json.dumps(
                {
                    "hostname": "edge-sw1",
                    "ip_address": "172.16.10.2",
                    "active": True,
                    "trace_mode": "on_fail",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(create_resp.status_code, 201)
        host_id = create_resp.json()["id"]

        update_resp = self.client.put(
            f"/api/host/{host_id}",
            data=json.dumps(
                {
                    "hostname": "edge-sw1-renamed",
                    "ip_address": "172.16.10.22",
                    "active": False,
                    "trace_mode": "always",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["hostname"], "edge-sw1-renamed")
        self.assertFalse(update_resp.json()["active"])
        self.assertEqual(update_resp.json()["trace_mode"], "always")

        delete_resp = self.client.delete(f"/api/host/{host_id}")
        self.assertEqual(delete_resp.status_code, 204)
        self.assertFalse(Host.objects.filter(id=host_id).exists())

    def test_hosts_page_route_renders(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Hosts")

    def test_results_and_host_detail_routes_render(self):
        host = Host.objects.create(hostname="router-d", ip_address="10.0.0.7", active=True)

        results_response = self.client.get("/results/")
        detail_response = self.client.get(f"/host/{host.id}/")

        self.assertEqual(results_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(results_response, "All Test Results")
        self.assertContains(detail_response, "Host Details")


class ReachabilityTaskTests(TestCase):
    def test_ping_host_socket_error_persists_failed_test(self):
        host = Host.objects.create(hostname="router-e", ip_address="10.0.0.8", active=True)

        hops = [SimpleNamespace(distance=1, address="10.0.0.1", avg_rtt=1.1)]
        with patch("reachability.tasks.ping", side_effect=exceptions.SocketPermissionError):
            with patch("reachability.tasks.traceroute", return_value=hops):
                result = ping_host(host.id)

        self.assertFalse(result["status"])
        self.assertIn("SocketPermissionError", result["msg"])
        self.assertTrue(result["trace_attempted"])
        self.assertEqual(Test.objects.filter(host=host).count(), 1)
        failed_test = Test.objects.get(host=host)
        self.assertFalse(failed_test.is_alive)
        self.assertEqual(failed_test.packet_loss, 100.0)
        self.assertTrue(failed_test.trace_attempted)
        self.assertIn("10.0.0.1", failed_test.trace_output)

    def test_ping_host_trace_mode_always_runs_trace_on_success(self):
        host = Host.objects.create(
            hostname="router-h",
            ip_address="10.0.0.11",
            active=True,
            trace_mode=Host.TRACE_MODE_ALWAYS,
        )
        ping_resp = SimpleNamespace(
            avg_rtt=2.5,
            min_rtt=2.1,
            max_rtt=3.0,
            packets_sent=4,
            packets_received=4,
            packet_loss=0.0,
            is_alive=True,
        )
        hops = [SimpleNamespace(distance=1, address="10.0.0.1", avg_rtt=0.7)]

        with patch("reachability.tasks.ping", return_value=ping_resp):
            with patch("reachability.tasks.traceroute", return_value=hops) as trace_mock:
                result = ping_host(host.id)

        self.assertTrue(result["status"])
        self.assertTrue(result["trace_attempted"])
        trace_mock.assert_called_once()
        created_test = Test.objects.get(host=host)
        self.assertTrue(created_test.trace_attempted)
        self.assertIn("10.0.0.1", created_test.trace_output)

    def test_ping_host_trace_mode_on_fail_skips_trace_when_ping_succeeds(self):
        host = Host.objects.create(
            hostname="router-i",
            ip_address="10.0.0.12",
            active=True,
            trace_mode=Host.TRACE_MODE_ON_FAIL,
        )
        ping_resp = SimpleNamespace(
            avg_rtt=2.5,
            min_rtt=2.1,
            max_rtt=3.0,
            packets_sent=4,
            packets_received=4,
            packet_loss=0.0,
            is_alive=True,
        )

        with patch("reachability.tasks.ping", return_value=ping_resp):
            with patch("reachability.tasks.traceroute") as trace_mock:
                result = ping_host(host.id)

        self.assertTrue(result["status"])
        self.assertFalse(result["trace_attempted"])
        trace_mock.assert_not_called()
        created_test = Test.objects.get(host=host)
        self.assertFalse(created_test.trace_attempted)
        self.assertEqual(created_test.trace_output, "")

    def test_run_traceroute_uses_system_fallback_on_permission_error(self):
        host = Host.objects.create(hostname="router-j", ip_address="10.0.0.13", active=True)
        completed = SimpleNamespace(
            stdout="traceroute to 10.0.0.13\n1 10.0.0.1 1.20 ms",
            stderr="",
            returncode=0,
        )

        with patch("reachability.tasks.traceroute", side_effect=exceptions.SocketPermissionError(False)):
            with patch("reachability.tasks.shutil.which", return_value="/usr/sbin/traceroute"):
                with patch("reachability.tasks.subprocess.run", return_value=completed) as run_mock:
                    attempted, output = _run_traceroute(host, privileged_ping=False)

        self.assertTrue(attempted)
        self.assertIn("traceroute to 10.0.0.13", output)
        run_mock.assert_called_once()

    def test_run_traceroute_uses_system_fallback_on_icmplib_type_error(self):
        host = Host.objects.create(hostname="router-k", ip_address="10.0.0.14", active=True)
        completed = SimpleNamespace(
            stdout="traceroute to 10.0.0.14\n1 10.0.0.1 1.20 ms",
            stderr="",
            returncode=0,
        )

        with patch(
            "reachability.tasks.traceroute",
            side_effect=TypeError(
                "ICMPRequest.__init__() got an unexpected keyword argument 'privileged'"
            ),
        ):
            with patch("reachability.tasks.shutil.which", return_value="/usr/sbin/traceroute"):
                with patch("reachability.tasks.subprocess.run", return_value=completed) as run_mock:
                    attempted, output = _run_traceroute(host, privileged_ping=False)

        self.assertTrue(attempted)
        self.assertIn("traceroute to 10.0.0.14", output)
        run_mock.assert_called_once()

    def test_poll_enqueues_ping_host_when_async_enabled(self):
        host = Host.objects.create(hostname="router-f", ip_address="10.0.0.9", active=True)

        with patch.dict(os.environ, {"PING_DISPATCH_ASYNC": "true"}):
            with patch("reachability.tasks.ping_host.delay") as delay_mock:
                result = poll()

        self.assertTrue(result["status"])
        self.assertEqual(result["hosts"], 1)
        delay_mock.assert_called_once_with(host.id)

    def test_poll_runs_ping_inline_by_default(self):
        host = Host.objects.create(hostname="router-g", ip_address="10.0.0.10", active=True)

        with patch("reachability.tasks.ping", side_effect=exceptions.SocketPermissionError):
            with patch("reachability.tasks.traceroute", return_value=[]):
                result = poll()

        self.assertTrue(result["status"])
        self.assertEqual(result["hosts"], 1)
        self.assertEqual(Test.objects.filter(host=host).count(), 1)
