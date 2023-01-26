from django.db import models


class Host(models.Model):
    hostname = models.CharField(max_length=50)
    ip_address = models.CharField(max_length=50)
    active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    @property
    def lastest_test(self):
        return Test.objects.filter(host_id=self.id).order_by('-timestamp')[:1].first()

    @property
    def avg_rtt(self):
        return self.lastest_test.avg_rtt

    @property
    def is_alive(self):
        return self.lastest_test.is_alive


    def __str__(self):
        return f'{self.hostname}'.lower()


class Test(models.Model):
    host = models.ForeignKey(Host, on_delete=models.CASCADE, related_name='tests')
    timestamp = models.DateTimeField(auto_now_add=True)
    avg_rtt = models.FloatField()
    min_rtt = models.FloatField()
    max_rtt = models.FloatField()
    packets_sent = models.IntegerField()
    packets_received = models.IntegerField()
    packet_loss = models.FloatField()
    is_alive = models.BooleanField()


    def __str__(self):
        return f'{self.timestamp} - {self.host.hostname}'.lower()