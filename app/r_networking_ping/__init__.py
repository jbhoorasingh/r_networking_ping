from .celery_app import app as celery_app

app = celery_app  # so "celery -A r_networking_ping" finds the app
__all__ = ("celery_app", "app")