---
layout: post
title: "Some thoughts about Axis2-Spring integration"
category: tech
tags:
 - Axis2
blogger: /2010/03/some-thoughts-about-axis2-spring.html
disqus: true
---

A longstanding issue with Axis2 is its lack of decent Spring integration. Currently the only available Spring support in
Axis2 addresses the use case of embedding a Spring container inside a service archive (AAR), i.e. implementing an Axis2
service using Spring. However, what most people are looking for is to embed Axis2 inside Spring, i.e. to configure and
manage the Axis2 runtime (including the deployed services) using Spring application contexts.

There are two third-party projects that attempt to address this shortcoming. One is [WSF Spring][1] from WSO2. The other
is a SourceForge hosted project called [Axis2M Spring][2], which (apparently) started as a fork of WSF Spring, but has
not yet been released. In this blog post I will have a look at these two projects, discuss their shortcomings and
establish a wish list for a decent Axis2-Spring integration. Note that I didn't really test these two projects and that
my conclusions are drawn from the project documentation and/or source code, so that I may have missed some aspects.
Also, if you want to get an idea of what a good Spring integration for a Web services stack should look like, you should
have a look at [Apache CXF][3].

## WSF Spring

The interesting thing in WSF Spring is that the entire Axis2 configuration can be done in Spring and that it gets rid of
`axis2.xml`. That's a good thing because that file is notoriously difficult to maintain. One reason is that there is no
XML schema for this file and that Axis2 doesn't do any validation, so that a typo doesn't trigger any error. The other
reason is that `axis2.xml` is not modularizable, which means that to customize the configuration, you need to take the
default `axis2.xml` file from the distribution and modify it. The problem with that approach is that it makes it
difficult to distinguish the standard settings (e.g. the phase configurations and message receivers which rarely need
customization) from the settings that are really specific to your project. What I would like to see is a mechanism that
allows me to configure only those parts that really need customization. E.g. I would like to be able to declare the
transports in my Spring configuration and to pull in the rest from default configuration files.

The problem with WSF Spring is that it actually replaces `axis2.xml` by Spring configurations that are much more obscure
and ugly than the original `axis2.xml`. An example can be seen [here][4]. It also fails to address the modularization
issue: simply, instead of doing this with `axis2.xml`, you now have to copy and edit an `axis2Config.xml` file.

Let's try to understand the reasons for these shortcomings in WSF Spring. The first one is that the framework doesn't
provide Spring namespace handlers which would make the configuration syntax easier and would also enable validation (and
autocompletion with an appropriate XML editor). The other reason is more subtle. In WSF Spring, the entire Axis2
configuration is actually provided by two beans. One is of type `org.wso2.spring.ws.SpringAxisConfiguration` and has
explicit references to other beans representing the different configuration items (transports, message receivers,
message formatters, etc.) found in `axis2.xml`. The other one is of type `org.wso2.spring.ws.WebServices` and contains a
collection representing the services to be deployed. This design is bad: things like transports, message formatters,
etc., as well as (individual) services should be top level beans that are automatically injected into the Axis2
configuration. This would enable real modularization because it allows to build the configuration from a set of
independent Spring configuration files without the need to reference the beans in these configuration files explicitly.
Apache CXF proves that it is possible to do this.

Having identified the most important shortcomings in WSF, what else can be said about this framework? First, services
are added in a way that mimics the deployment through `services.xml` (see [here][5] for an example). Because of
[AXIS2-4611][6], this implies that there is no support for JAX-WS. Thus, WSF Spring fails to address one of the most
popular use cases, which is Servlet + Spring + JAX-WS. Also, looking at the code, it seems that WSF Spring doesn't
support building the AxisService description from a preexisting WSDL. Finally, it should be noted that WSF Spring has no
support for the client side.

## Axis2M Spring

Since Axis2M Spring is a fork of WSF Spring, some of the issues we have identified for WSF Spring are also present in
Axis2M Spring, namely the lack of JAX-WS and client side support, as well as the missing support for building
AxisService descriptions from preexisting WSDLs. On the other hand, there are several important differences between
these two frameworks. The first one is that Axis2M recognizes the usefulness of Spring namespace handlers to make
configuration easier (although Spring namespace support is not really "the latest trend with spring based developments",
but has existed for some time now...).

The second difference is that Axis2M Spring uses the traditional `axis2.xml` in addition to the Spring configuration
(which is only used to define services and modules). Even if WSF Spring didn't get this part right either, this should
be considered as a step backwards.

Another area where Axis2M Spring represents progress with respect to WSF Spring is the fact that services can be
declared as top level beans, pretty much in the same way as other WS stacks do it. As explained earlier, this is
important for modularization. Also interesting is the idea of implementing Axis2 modules with Spring configuration.

## Wish list

From the above comments, it is clear that neither of the two frameworks considered in this post provides a definite
solution for the Axis2-Spring integration problem. By looking at the issues that have been identified (and at Apache
CXF...), it is easy to establish a wish list for Spring support in Axis2:

* Support for JAX-WS. In particular the Spring support must provide an easy solution for the popular Servlet + Spring +
  JAX-WS use case.

* All configuration (including the basic Axis2 configuration now done in `axis2.xml`) should be done in Spring and
  namespace handlers should be used consistently so that the configuration can be validated against an XML schema.
  Wherever appropriate, the configuration syntax should be similar to `axis2.xml` and `services.xml` to make transition
  easy.

* Services as well as transports, message receivers, phase configurations, etc. should be top-level elements and they
  should be taken into account without the need to reference them from a central place, so that the configuration can be
  kept simple and modular.

Not mentioned in this wish list are the requirements that should be considered as prerequisites that must be satisfied
by any Axis2-Spring integration (and that I didn't validate with the two frameworks considered in this post):

* Correct lifecycle support for request and session scoped services.

* Support for dependency injection and proxying for all user supplied objects: services, handlers, modules, password
  callbacks, etc.

* Ability to run in a servlet container as well as standalone (e.g. with JMS transport only).

[1]: http://wso2.org/projects/wsf/spring
[2]: http://axis2m.sourceforge.net/axis2m-spring.html
[3]: http://cxf.apache.org/
[4]: https://wso2.org/repos/wso2/tags/wsf/spring/release-1.5/samples/webapp/src/main/webapp/WEB-INF/axis2Config.xml
[5]: https://wso2.org/repos/wso2/tags/wsf/spring/release-1.5/samples/webapp/src/main/webapp/WEB-INF/applicationContext.xml
[6]: https://issues.apache.org/jira/browse/AXIS2-4611
