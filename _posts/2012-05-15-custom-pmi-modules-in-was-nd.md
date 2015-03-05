---
layout: post
title: "Using custom PMI modules in a Network Deployment cell"
category: tech
tags:
 - WebSphere
 - PMI
blogger: /2012/05/using-custom-pmi-modules-in-network.html
disqus: true
description: >
 The WebSphere documentation has a section that explains how to implement a custom PMI module.
 This works well on a stand-alone application server, but not in a Network Deployment cell: the
 custom PMI module shows up in the admin console, but not the individual statistics defined by the
 module. This article describes how to solve this issue.
---

The WebSphere documentation has a section that explains [how to implement a custom PMI module][1].
This works well on a stand-alone application server, but not in a Network Deployment cell: the
custom PMI module shows up in the admin console, but not the individual statistics defined by the
module. The reason is that the deployment manager doesn't have access to the stats template
(XML file) and the resource bundle (properties file). To solve this issue, these two files need to
be added to the class path of the deployment manager.

Note that when looking up the stats template for a PMI module that is registered in an application
server, the deployment manager derives the resource name of the stats template from the module ID
(which corresponds to the value of the `type` attribute of the `Stats` element in the template) by
replacing all dots by slashes and appending `.xml`. For the example shown in the WebSphere
documentation this would be `com/stats/MyStats.xml`. Note that the application code that registers
the PMI module on the application server is not required to use this resource name (because the
template location is passed as parameter to the corresponding `StatsFactory` methods). Therefore it
is in general not enough to simply extract the stats template and resource bundle from the
application: the stats template may need to be renamed or placed in a different package when
installing it on the deployment manager.

[1]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.nd.multiplatform.doc/info/ae/ae/tprf_stats_pmi.html