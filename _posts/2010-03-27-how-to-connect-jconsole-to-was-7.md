---
layout: post
title: "How to connect JConsole to WAS 7"
category: tech
tags:
 - WebSphere
blogger: /2010/03/how-to-connect-jconsole-to-was-7.html
disqus: true
description: >
 This article describes how to connect JConsole (on Windows) to WAS 7.0.
updated: 2016-11-15
---

**Update:** To make your life easier you may want to use the
[VisualWAS plugin](https://github.com/veithen/visualwas) for VisualVM instead of trying to connect
JConsole to WebSphere as described in this post. VisualVM supports all the features that JConsole
has, and the VisualWAS plugin makes it very easy to connect VisualVM to WebSphere. The VisualWAS
project also provides an extension for WebSphere that makes the platform MXBeans available in
WebSphere's MBean server, so that memory, CPU and GC information can be visualized.

---

It's a bit tricky, but it's perfectly possible to connect (Sun's) JConsole to a remote WAS7 instance
without any special server setup. You will only need to add a couple of JARs from the WAS runtime to
JConsole's classpath. Also, the JMX URL to use is a bit special. Here is a Batch script for Windows
that you can use as a starting point:

    set JAVA_HOME=c:\Program Files\java\jdk1.6.0_17
    set WAS_HOME=c:\IBM\WebSphere\AppServer
    set CP=%JAVA_HOME%\lib\jconsole.jar
    set CP=%CP%;%WAS_HOME%\runtimes\com.ibm.ws.admin.client_7.0.0.jar
    set CP=%CP%;%WAS_HOME%\runtimes\com.ibm.ws.ejb.thinclient_7.0.0.jar
    set CP=%CP%;%WAS_HOME%\runtimes\com.ibm.ws.orb_7.0.0.jar
    set HOST=localhost
    set PORT=9100<br />"%JAVA_HOME%\bin\jconsole" -J-Djava.class.path="%CP%" ^
            service:jmx:iiop://%HOST%:%PORT%/jndi/JMXConnector

`PORT` must be set to the `ORB_LISTENER_ADDRESS` in the WebSphere configuration.
