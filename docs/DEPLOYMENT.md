# Deployment Guide

This document covers Docker deployment for:
1. Development stack (`docker-compose.dev.yml` / `docker-compose.yml`).
2. Production stack (`docker-compose.prod.yml`).

## Files
1. `docker-compose.yml`: development stack.
2. `docker-compose.dev.yml`: same as development stack.
3. `docker-compose.prod.yml`: production stack with Nginx, replicas, and memory limits.
4. `nginx/prod.conf`: Nginx reverse proxy configuration for production.

## Production Architecture
Services:
1. `nginx`: reverse proxy/load balancer on port `80`.
2. `web`: Django + Gunicorn (multiple replicas supported).
3. `worker`: Celery worker.
4. `beat`: Celery beat scheduler.
5. `db`: PostgreSQL.
6. `redis`: Redis broker/backend.
7. `migrate`: one-off migration job before app workers start.

## Networking and Routing
1. All services run on one shared Docker network: `app`.
2. `nginx` proxies incoming requests to `web:8000`.
3. `worker` and `beat` keep outbound network access through normal Docker bridge egress.

`DJANGO_ALLOWED_HOSTS` must include hostnames/IPs you expect Django to serve.

## Required Environment
Set before starting production:
```bash
export WEB_REPLICAS=3
```
Optional hardening:
```bash
export DJANGO_ALLOWED_HOSTS=ping.example.com,10.0.0.10,192.168.1.25
```
If not set, production compose defaults to `DJANGO_ALLOWED_HOSTS=*`.

Keep these files populated:
1. `app/.env`
2. `.db.env`

## Start Production
Start services:
```bash
docker compose -f docker-compose.prod.yml up -d --build --scale web=${WEB_REPLICAS:-3}
```
The stack runs migrations automatically through the `migrate` service before `web`, `worker`, and `beat` start.

## Scaling
Scale Django app containers:
```bash
docker compose -f docker-compose.prod.yml up -d --scale web=5
```

## Memory Limits
The production compose sets:
1. `mem_limit` for compose runtime limits.
2. `deploy.resources.limits.memory` for swarm-style deploy metadata.

If you deploy with Swarm and want `deploy.*` behavior enforced:
```bash
docker stack deploy -c docker-compose.prod.yml r-networking-ping
```

## Notes
1. `web` runs `collectstatic` before starting Gunicorn.
2. Static files are served by WhiteNoise inside Django.
