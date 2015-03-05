---
layout: post
title: "Running RHQ in a Docker container"
category: tech
tags:
 - Docker
 - RHQ
disqus: true
description: >
 This article presents a complete Dockerfile that can be used to run a test instance of RHQ in a Docker container.
---

The following Dockerfile can be used to run [RHQ](http://rhq.jboss.org) 4.12 in a Docker container.
Please note that the setup is not suitable for production use; it is primarily designed to quickly
provision an RHQ test instance. The RHQ instance listens on port 7080 and the default login is
`rhqadmin`/`rhqadmin`.

## Dockerfile

    FROM ubuntu:trusty
    # Set ulimit -n to work around https://bugs.launchpad.net/ubuntu/+source/apt/+bug/1332440
    RUN \
     ulimit -n 1024 && \
     apt-get update && \
     apt-get install -y wget unzip openjdk-7-jdk postgresql-9.3 supervisor patch patchutils
    RUN \
     wget -q http://downloads.sourceforge.net/project/rhq/rhq/rhq-4.12/rhq-server-4.12.0.zip \
          -O /tmp/rhq.zip && \
     mkdir -p /opt/rhq && \
     unzip -q -d /opt/rhq /tmp/rhq.zip && \
     mv /opt/rhq/rhq-server-* /opt/rhq/rhq-server && \
     rm /tmp/rhq.zip
    USER postgres
    RUN \
     pg_ctlcluster 9.3 main start && \
     psql -c "create user rhqadmin with password 'rhqadmin';" && \
     createdb -O rhqadmin rhq && \
     pg_ctlcluster 9.3 main stop
    USER root
    ENV RHQ_JAVA_HOME /usr/lib/jvm/java-7-openjdk-amd64/jre
    RUN \
     sed -i -e 's/^#\?\(jboss\.bind\.address\)=.*/\1=0.0.0.0/' \
            -e 's/^#\?\(rhq\.server\.high-availability\.name\)=.*/\1=rhq-test-instance/' \
            -e 's/^#\?\(rhq\.sync\.endpoint-address\)=.*/\1=true/' \
       /opt/rhq/rhq-server/bin/rhq-server.properties && \
     sed -i -e 's/^#\?\(rhq\.storage\.hostname\)=.*/\1=localhost/' \
            -e 's/^#\?\(rhq\.storage\.seeds\)=.*/\1=localhost/' \
       /opt/rhq/rhq-server/bin/rhq-storage.properties
    RUN \
     /etc/init.d/postgresql start && \
     /opt/rhq/rhq-server/bin/rhqctl install && \
     /etc/init.d/postgresql stop && \
     rm -rf /opt/rhq/rhq-server/jbossas/standalone/configuration/standalone-full_xml_history && \
     find /opt/rhq/rhq-server/logs -type f -exec rm '{}' ';'
    ADD rhq.ini /opt/rhq/rhq.ini
    RUN \
     wget -q https://github.com/rhq-project/rhq/commit/914d70c2.patch \
          -O /tmp/sigterm.patch && \
     PATCH="patch --no-backup-if-mismatch" && \
     filterdiff -i "*/rhq-agent.sh" /tmp/sigterm.patch | $PATCH -d /opt/rhq/rhq-agent/bin -p6 && \
     filterdiff -i "*/rhq-server.sh" /tmp/sigterm.patch | $PATCH -d /opt/rhq/rhq-server -p8 && \
     rm /tmp/sigterm.patch
    EXPOSE 7080
    CMD ["supervisord", "-c", "/opt/rhq/rhq.ini"]

## rhq.ini

    [supervisord]
    nodaemon=true
    
    [program:postgresql]
    priority=1
    user=postgres
    command=/usr/lib/postgresql/9.3/bin/postgres -D /var/lib/postgresql/9.3/main -c config_file=/etc/postgresql/9.3/main/postgresql.conf
    autorestart=true
    stopwaitsecs=30
    
    [program:rhq-storage]
    priority=2
    directory=/opt/rhq/rhq-server/rhq-storage/bin
    command=/opt/rhq/rhq-server/rhq-storage/bin/cassandra -f
    autorestart=true
    stopwaitsecs=30
    
    [program:rhq-server]
    priority=3
    command=/opt/rhq/rhq-server/bin/internal/rhq-server.sh console
    autorestart=true
    stopwaitsecs=30
    
    [program:rhq-agent]
    priority=4
    command=/opt/rhq/rhq-agent/bin/rhq-agent.sh -d
    autorestart=true
    stopwaitsecs=30
