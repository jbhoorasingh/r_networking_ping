# Deployment Guide

This document covers Docker deployment for:
1. Development stack (`docker-compose.dev.yml` / `docker-compose.yml`).
2. Production stack (`docker-compose.prod.yml`).

## Files
1. `docker-compose.yml`: development stack.
2. `docker-compose.dev.yml`: same as development stack.
3. `docker-compose.prod.yml`: production stack with Traefik, replicas, and memory limits.

## Production Architecture
Services:
1. `traefik`: reverse proxy/load balancer on port `80` (dashboard on `8080`).
2. `web`: Django + Gunicorn (multiple replicas supported).
3. `worker`: Celery worker.
4. `beat`: Celery beat scheduler.
5. `db`: PostgreSQL.
6. `redis`: Redis broker/backend.

## Routing (Traefik)
The `web` router accepts:
1. Hostname requests matching `TRAEFIK_HOST`.
2. RFC1918 IPv4 host headers (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
3. Direct IP requests (bracketed IPv6 host headers).

`DJANGO_ALLOWED_HOSTS` must still include any hostnames/IPs you expect Django to serve.

## Required Environment
Set before starting production:
```bash
export TRAEFIK_HOST=ping.example.com
export DJANGO_ALLOWED_HOSTS=ping.example.com
export WEB_REPLICAS=3
```

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
3. Traefik dashboard (`:8080`) is enabled with insecure mode for convenience; disable before internet exposure.
