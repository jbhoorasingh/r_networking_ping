FROM python:3.12-slim-bookworm AS builder
LABEL maintainer="Jermaine Bhoorasingh <r_networking_ping@jermaine.co>"

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        traceroute \
    && rm -rf /var/lib/apt/lists/*
# install dependencies
RUN pip install --upgrade pip
COPY ./requirements.txt .
RUN pip install -r requirements.txt
#RUN echo "net.ipv4.ping_group_range = 0 2147483647" >> /etc/sysctl.conf

# copy project
COPY . .
