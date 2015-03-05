---
layout: post
title: "RHQ WebSphere plug-in released!"
category: tech
tags:
 - RHQ
 - WebSphere
blogger: /2012/10/rhq-websphere-plug-in-released.html
disqus: true
description: >
 I've been working for quite some time now on a WebSphere plug-in for RHQ. It has already been running successfully for
 more than a year in a production environment with several dozens WebSphere Application Server instances, and the first
 official release of the plug-in is now available.
---

I've been working for quite some time now on a WebSphere plug-in for [RHQ](http://www.jboss.org/rhq). RHQ is an Open
Source enterprise management and monitoring solution written in Java and is part of the JBoss universe. It already has
support for numerous server-side products, but is missing integration with proprietary application server platforms such
as WebSphere and Weblogic. My plug-in attempts to close this gap for WebSphere, and to provide an Open Source
alternative to commercial products such as IBM Tivoli Monitoring.

It has already been running successfully for more than a year in a production environment with several dozens WebSphere
Application Server instances, but until recently it lacked some operability features and the necessary documentation to
allow it to be used by a larger public. I've been working on these issues over the last couple of weeks and I'm proud to
announce that the first official release of the plug-in is now available. You can find the binary packages and
documentation [here](http://code.google.com/p/rhq-websphere-plugin/).

The RHQ WebSphere plug-in primarily focuses on monitoring, and to some extend on managing the runtime state of the
monitored WebSphere servers. It doesn't provide any features to manage the WebSphere configuration. The reason is that
WebSphere already has outstanding capabilities in that area (both for manual and scripted configuration management) and
that the configuration model used by WebSphere doesn't fit naturally into RHQ's world view. The plug-in collects many of
the metrics available through WebSphere's PMI (Performance Monitoring Infrastructure) API. In addition to that, it has
some advanced monitoring capabilities that are not readily available with other solutions:

*   The plug-in can connect to DB2 to collect agent (i.e. per connection) statistics. These metrics are then aggregated
    per data source configured in WebSphere. This allows you for example to determine the CPU time consumed on the DB2
    instance by applications using a given data source.

*   The plug-in can measure the number of leaked application class loaders. The data is provided per application/module
    and as a global (per WebSphere instance) metric. This makes it easier to investigate out of memory conditions and to
    decide when it's time to restart a WebSphere instance because of too many application restarts or redeployments.

*   The plug-in can be configured to remotely collect log events from the monitored WebSphere instances and to correlate
    these events with the component, module or application that triggered them (which is something that is not possible
    to do by inspecting `SystemOut.log`).

Note that the last two features are only available in conjunction with [XM4WAS](http://code.google.com/p/xm4was/),
another project of mine.
