import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "r_networking_ping.settings")
app = Celery("r_networking_ping")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

