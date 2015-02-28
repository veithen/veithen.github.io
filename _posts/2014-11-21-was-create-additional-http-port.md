---
layout: post
title: "Creating an additional HTTP port on WebSphere Application Server"
category: tech
tags:
 - WebSphere
disqus: true
---

When creating a new application server, WebSphere automatically sets up an HTTP and an HTTPS port
on which applications can be mapped (via the `default_host` virtual host). Sometimes it may be
desirable to create an additional HTTP or HTTPS port. The following procedure describes how to
do this using the administrative console. It works for standalone servers as well as Network
Deployment profiles. Note however that for a cluster all the steps except updating the virtual hosts
need to be executed for each cluster member separately.

Here are the steps:

1. Go to the admin console page for the application server on which you want to create an additional
   HTTP(S) port.
   
1. Under *Web Container Settings* click on *[Web container transport chains][1]*.

1. Click *New*.

1. In *Step 1* of the wizard, specify a transport chain name. You can use any name, but it is a good idea
   to chose a name that starts with `WCInbound` (to match the convention used for the chains set
   up by WebSphere by default, such as `WCInboundDefault`). On the same page, the
   *Transport chain template* drop-down list allows you to choose between creating of an HTTP
   port (*WebContainer*) or an HTTPS port (*WebContainer-Secure*).

1. In *Step 2* create a new port as follows:

   * *Port name*: again, you can use any name, but in order to follow the same conventions as for
     the existing ports, choose one that starts with `WC_`.
   
   * *Host*: in general, this should be `*` (unless you want to restrict the network interfaces on
     which to listen; e.g. you could specify `localhost` or `127.0.0.1` to listen only on the
     loopback device).
   
   * *Port*: the TCP port number for the new HTTP(S) port.

1. In *Step 3* confirm the settings.

By default, the newly created HTTP(S) port will use the same thread pool (`WebContainer`) as the
default HTTP(S) ports. For the purpose of better isolation, it may be desirable to use a separate
thread pool. In this case, execute the following additional steps:

1. [Create a new thread pool][2].

1. Go back to the *Web container transport chains* page and click on the newly created chain.

1. Click on *TCP inbound channel* and select the new thread pool.

Finally, to be able to use the new port, you also need to make sure that your WebSphere configuration
has a virtual host with a corresponding alias. In most cases this means [updating][3] the existing `default_host`
to add a new alias with the right port number.

[1]: http://www-01.ibm.com/support/knowledgecenter/SSAW57_8.5.5/com.ibm.websphere.nd.doc/ae/trun_chain_transport.html
[2]: http://www-01.ibm.com/support/knowledgecenter/SSAW57_8.5.5/com.ibm.websphere.nd.doc/ae/uejb_thrdpool.html
[3]: http://www-01.ibm.com/support/knowledgecenter/SSAW57_8.5.5/com.ibm.websphere.nd.doc/ae/urun_rvhost_alias.html