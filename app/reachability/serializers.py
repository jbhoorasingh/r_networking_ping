from rest_framework import serializers
from .models import Host, Test


class HostSerializer(serializers.ModelSerializer):
    # lastest_test = serializers.ModelSerializer(te)

    class Meta:
        model = Host
        fields = [
            'id',
            'hostname',
            'ip_address',
            'active',
            'trace_mode',
            'avg_rtt',
            'is_alive',
            'created',
        ]


class TestSerializer(serializers.ModelSerializer):
    host_name = serializers.CharField(source='host.hostname', read_only=True)
    host_ip = serializers.CharField(source='host.ip_address', read_only=True)

    class Meta:
        model = Test
        fields = [
            'id',
            'host',
            'host_name',
            'host_ip',
            'timestamp',
            'avg_rtt',
            'min_rtt',
            'max_rtt',
            'packets_sent',
            'packets_received',
            'packet_loss',
            'is_alive',
            'trace_attempted',
            'trace_output',
        ]
