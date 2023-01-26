# Generated by Django 4.1.4 on 2022-12-08 01:07

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Host',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostname', models.CharField(max_length=50)),
                ('ip_address', models.CharField(max_length=50)),
                ('active', models.BooleanField(default=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Test',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('latency', models.FloatField()),
                ('status', models.BooleanField()),
                ('host', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tests', to='reachability.host')),
            ],
        ),
    ]
