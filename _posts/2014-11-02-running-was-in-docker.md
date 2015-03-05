---
layout: post
title: "Running WebSphere Application Server (full profile) in a Docker container"
category: tech
tags:
 - Docker
 - WebSphere
blogger: /2014/11/running-was-in-docker.html
updated: 2015-02-24
description: This article describes how to run a full profile of WebSphere Application Server 8.x in a Docker container.
---

## Introduction

This article describes how to run WebSphere Application Server in a Docker container. We are going
to use the [developer version][1] of WAS 8.5.5 to create a full profile, but the instructions can easily be
adapted to a regular WebSphere version (provided you have an appropriate license) or a different WebSphere 8.x version.
Note however that the solution will not work with WAS 7.0 because the installation procedure is completely different.

## Creating the Docker image

To create the
Docker image, [download IBM Installation Manager][2] for Linux x86_64 and use the following
Dockerfile, after replacing the `-userName` and `-userPassword` arguments with your IBM ID:

    FROM centos:centos6
    
    RUN yum install -q -y unzip
    
    ADD agent.installer.linux.gtk.x86_64_*.zip /tmp/
    
    RUN \
     unzip -qd /tmp/im /tmp/agent.installer.linux.gtk.x86_64_*.zip && \
     /tmp/im/installc \
       -acceptLicense \
       -showProgress \
       -installationDirectory /usr/lib/im \
       -dataLocation /var/im && \
     rm -rf /tmp/agent.installer.linux.gtk.x86_64_*.zip /tmp/im
    
    RUN \
     REPO=http://www.ibm.com/software/repositorymanager/V85WASDeveloperILAN && \
     /usr/lib/im/eclipse/tools/imutilsc saveCredential \
       -url $REPO \
       -userName my.ibm.id@mydomain.com \
       -userPassword mypassword \
       -secureStorageFile /root/credentials && \
     /usr/lib/im/eclipse/tools/imcl install \
       com.ibm.websphere.DEVELOPERSILAN.v85_8.5.5003.20140730_1249 \
       -repositories $REPO \
       -acceptLicense \
       -showProgress \
       -secureStorageFile /root/credentials \
       -sharedResourcesDirectory /var/cache/im \
       -preferences com.ibm.cic.common.core.preferences.preserveDownloadedArtifacts=false \
       -installationDirectory /usr/lib/was && \
     rm /root/credentials
    
    RUN useradd --system -s /sbin/nologin -d /var/was was
    
    RUN \
     hostname=$(hostname) && \
     /usr/lib/was/bin/manageprofiles.sh -create \
       -templatePath /usr/lib/was/profileTemplates/default \
       -profileName default \
       -profilePath /var/was \
       -cellName test -nodeName node1 -serverName server1 \
       -hostName $hostname && \
     echo -n $hostname > /var/was/.hostname && \
     chown -R was:was /var/was
    
    USER was
    
    RUN echo -en '#!/bin/bash\n\
    set -e\n\
    node_dir=/var/was/config/cells/test/nodes/node1\n\
    launch_script=/var/was/bin/start_server1.sh\n\
    old_hostname=$(cat /var/was/.hostname)\n\
    hostname=$(hostname)\n\
    if [ $old_hostname != $hostname ]; then\n\
      echo "Updating configuration with new hostname..."\n\
      sed -i -e "s/\"$old_hostname\"/\"$hostname\"/" $node_dir/serverindex.xml\n\
      echo $hostname > /var/was/.hostname\n\
    fi\n\
    if [ ! -e $launch_script ] ||\n\
       [ $node_dir/servers/server1/server.xml -nt $launch_script ]; then\n\
      echo "Generating launch script..."\n\
      /var/was/bin/startServer.sh server1 -script $launch_script\n\
    fi\n\
    ' > /var/was/bin/updateConfig.sh && chmod a+x /var/was/bin/updateConfig.sh
    
    # Speed up the first start of a new container
    RUN /var/was/bin/updateConfig.sh
    
    RUN echo -en '#!/bin/bash\n\
    set -e\n\
    /var/was/bin/updateConfig.sh\n\
    echo "Starting server..."\n\
    exec /var/was/bin/start_server1.sh\n\
    ' > /var/was/bin/start.sh && chmod a+x /var/was/bin/start.sh
    
    CMD ["/var/was/bin/start.sh"]

**Note that by executing this Dockerfile you accept the license agreement for IBM Installation
Manager and WebSphere Application Server for Developers.**

## Known issues

The execution of the `imutilsc` may fail with the following error, even though you have specified a valid user name and
password:

    Cannot connect to the URL.
      - Verify that the URL is correct.
      - Verify that the user name and password are correct.
      - Verify that you can access the network.

The root cause for that is IBM inability to correctly configure its CDN:

    $ curl -i http://www.ibm.com/software/repositorymanager/V85WASDeveloperILAN/
    HTTP/1.1 302 Moved Temporarily
    Cache-Control: max-age=301
    Expires: Tue, 24 Feb 2015 23:14:44 GMT
    Content-Type: text/html
    Location: https://www-912.ibm.com/software/repositorymanager/V85WASDeveloperILAN/
    Content-Length: 255
    epKe-Alive: timeout=10, max=7
    Date: Tue, 24 Feb 2015 23:09:43 GMT
    Connection: keep-alive
    
    <!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
    <html><head>
    <title>302 Found</title>
    </head><body>
    <h1>Found</h1>
    <p>The document has moved <a href="https://www-912.ibm.com/software/repositorymanager/V85WASDeveloperILAN/">here</a>.</p>
    </body></html>
    $ curl -I http://www.ibm.com/software/repositorymanager/V85WASDeveloperILAN/
    HTTP/1.1 503 Service Unavailable
    Server: AkamaiGHost
    Mime-Version: 1.0
    Content-Type: text/html
    Content-Length: 177
    Expires: Tue, 24 Feb 2015 23:09:52 GMT
    Date: Tue, 24 Feb 2015 23:09:52 GMT
    Connection: keep-alive
    
    $

The output of these two commands show that a GET request to the repository URL gets redirected with HTTP status 302,
while a HEAD request for the same URL results in a 503 error. The problem is that `imutilsc` uses a HEAD request and
therefore fails. The work around this issue, replace the value of the `REPO` variable with the location obtained from
the 302 response. In the example shown above, this would be
`https://www-912.ibm.com/software/repositorymanager/V85WASDeveloperILAN/`.

## How it works

Here are some more details about the Dockerfile:

*   Only IBM Installation Manager needs to be downloaded before creating the image. The product
    itself (WebSphere Application Server for Developers 8.5.5) is downloaded by Installation
    Manager during image creation. Note that this may take a while. The
    `preserveDownloadedArtifacts=false` preference instructs Installation Manager to remove the
    downloaded packages. This reduces the size of the image.

*   The Dockerfile creates a default application server profile that is configured to run as a
    non-root user. The HTTP port is 9080 and the URL of the admin console is
    `http://...:9060/ibm/console`. New containers should typically be created with the following options:
    `-p 9060:9060 -p 9080:9080`. Refer to the [Port number settings][3] page in the Knowledge Center for a complete list
    of ports used by WAS. Note that this page doesn't mention the default port used for remote debugging, which is
    7777.

*   To see the WebSphere server logs, use the following command (requires Docker 1.3):
    
        docker exec <container_id> tail -F /var/was/logs/server1/SystemOut.log
    
*   Docker assigns a new hostname to every newly created container. This is a problem because
    the `serverindex.xml` file in the configuration of the WebSphere profile contains the hostname.
    That is to say that WebSphere implicitly assumes that the hostname is static and not expected
    to change after the profile has been created. To overcome this problem the Dockerfile adds a
    script called `updateConfig.sh` to the image. That script is executed before the server is
    started and (among other things) updates the hostnames in `serverindex.xml` when necessary.

*   Docker expects the RUN command to run the server process in the foreground (instead of allowing
    it to detach) and to gracefully stop the server when receiving a TERM signal. WebSphere's
    `startServer.sh` command doesn't meet these requirements. This issue is solved by using the
    `-script` option, which tells `startServer.sh` to generate a launch script instead of starting
    the server. This launch script has the desired properties and is used by the RUN command.
    This has an additional benefit: the `startServer.sh` command itself takes a significant amount
    of time (it's a Java process that reads the configuration and then starts a separate process
    for the actual WebSphere server) and skipping it reduces the startup time.
    
    There is however a problem with this approach. The content of the launch script generated by
    `startServer.sh` depends on the server configuration, in particular the JVM settings specified
    in `server.xml`. When they change, the launch script needs to be regenerated. This can be
    easily detected and the `updateConfig.sh` script added by the Dockerfile is designed to take
    care of this.
    
*   The RUN command is a script that first runs `updateConfig.sh` and then executes the launch
    script. In addition to that, `updateConfig.sh` is also executed once during the image creation.
    This will speed up the first start of a new container created from that image, not only because
    the launch script will already exist, but also because the very first execution of the
    `startServer.sh` script typically takes much longer to complete.

[1]: http://www.ibm.com/developerworks/downloads/ws/wasdevelopers/
[2]: http://www-01.ibm.com/support/docview.wss?uid=swg24037640#DNLD
[3]: http://www-01.ibm.com/support/knowledgecenter/SSEQTP_8.5.5/com.ibm.websphere.base.doc/ae/rmig_portnumber.html