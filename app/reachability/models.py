from django.db import models


class Host(models.Model):
    TRACE_MODE_ALWAYS = "always"
    TRACE_MODE_ON_FAIL = "on_fail"
    TRACE_MODE_CHOICES = (
        (TRACE_MODE_ALWAYS, "Every probe"),
        (TRACE_MODE_ON_FAIL, "Only when ping fails"),
    )

    hostname = models.CharField(max_length=50)
    ip_address = models.CharField(max_length=50)
    active = models.BooleanField(default=True)
    trace_mode = models.CharField(
        max_length=16,
        choices=TRACE_MODE_CHOICES,
        default=TRACE_MODE_ON_FAIL,
    )
    created = models.DateTimeField(auto_now_add=True)

    @property
    def lastest_test(self):
        return Test.objects.filter(host_id=self.id).order_by('-timestamp').first()

    @property
    def avg_rtt(self):
        latest_test = self.lastest_test
        if latest_test is None:
            return None
        return latest_test.avg_rtt

    @property
    def is_alive(self):
        latest_test = self.lastest_test
        if latest_test is None:
            return None
        return latest_test.is_alive


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
    trace_attempted = models.BooleanField(default=False)
    trace_output = models.TextField(blank=True, default="")


    def __str__(self):
        return f'{self.timestamp} - {self.host.hostname}'.lower()
