from rest_framework import serializers
from .models import Host, Test


class HostSerializer(serializers.ModelSerializer):
    # lastest_test = serializers.ModelSerializer(te)

    class Meta:
        model = Host
        fields = ['id', 'hostname', 'ip_address', 'active', 'avg_rtt', 'is_alive', 'created']


class TestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = [
            'id',
            'host',
            'timestamp',
            'avg_rtt',
            'min_rtt',
            'max_rtt',
            'packets_sent',
            'packets_received',
            'packet_loss',
            'is_alive'
        ]