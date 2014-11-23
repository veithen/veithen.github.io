---
layout: post
title: "How to connect JConsole to WAS 7"
category: tech
tags:
 - WebSphere
blogger: /2010/03/how-to-connect-jconsole-to-was-7.html
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
