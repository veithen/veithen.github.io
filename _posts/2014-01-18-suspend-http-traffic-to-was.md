---
layout: post
title: "How to suspend HTTP traffic to a WebSphere Application Server"
category: tech
tags:
 - WebSphere
image: /2014/01/18/screenshot.png
blogger: /2014/01/suspend-http-traffic-to-was.html
disqus: true
description: >
 Learn how to use the WebContainer MBean to temporarily suspend HTTP traffic to a WebSphere Application Server instance.
---

One of the annoying things with the WebSphere plug-in for IBM HTTP Server is that there is no straightforward way to
suspend traffic to a given application server. The problem is that the plug-in is not aware of the runtime weights of
the members in a WebSphere cluster. The only way to suspend HTTP traffic to a given server is to set the configured
weight of the cluster member to zero and then to regenerate and propagate the plug-in configuration file. The plug-in
will automatically reread that file and stop sending HTTP requests to the server. Alternatively, one can also edit the
`plugin-cfg.xml` file manually to temporarily set the `LoadBalanceWeight` to zero.

Obviously this method is cumbersome, especially compared to how this kind of operation is done on other load balancers.
On the other hand, one of the advantages of the WebSphere plug-in is that it able to detect a stopped member and fail
over the connections without loosing requests: as soon as it detects that the HTTP port on the WebSphere server is
closed, it will redirect requests (including the request that caused the attempt to establish the connection to the
application server) to other cluster members. Therefore another approach would be to instruct the application server to
(temporarily) close its HTTP port(s) in order to force the WebSphere plug-in to route requests to other members.

It turns out that this is indeed possible. Each application server has an MBean of type `WebContainer` with operations
`stopTransports` and `startTransports`. The first operation stops all HTTP transports and closes the corresponding
ports, i.e. `WC_defaulthost` and `WC_defaulthost_secure` (as well as `WC_adminhost` and `WC_adminhost_secure` on
stand-alone servers and deployment managers). The second operation restores normal operation.

![WebContainer MBean operations](screenshot.png)

As noted in [PK96239][1], the `WebContainer` MBean was deprecated in WAS 6.1 and has been replaced by the
`TransportChannelService` MBean. However, the latter is much more difficult to use and as of WAS 8.5.5, the
`WebContainer` MBean is still supported. Therefore using the `WebContainer` MBean remains the preferred method to do
this.

It should also be noted that using the `stopTransports` to suspend HTTP traffic to a WebSphere server may have some
drawbacks in certain situations. The most important one is that since the HTTP ports are closed, it is no longer
possible to send any kind of HTTP request to the server. In particular it is no longer possible to send test requests
directly to the server. One should also be careful if there are applications deployed on the server that may send HTTP
requests to the server itself (via `localhost`) in response to requests received via protocols other than HTTP, such as
IIOP (remote EJB calls) or JMS.

[1]: http://www-01.ibm.com/support/docview.wss?uid=swg1PK96239
