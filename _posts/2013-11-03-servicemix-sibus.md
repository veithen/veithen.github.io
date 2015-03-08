---
layout: post
title: "Integrating ServiceMix with WebSphere's SIBus"
category: tech
tags:
 - ServiceMix
 - WebSphere
 - SIBus
blogger: /2013/11/servicemix-sibus.html
disqus: true
description: >
 This article describes how to integrate Apache ServiceMix with WebSphere's SIBus. More precisely it explores how
 to deploy a Camel route that sends messages to a SIBus destination in WebSphere.
---

This article describes how to integrate Apache ServiceMix with WebSphere's SIBus. More precisely we will explore how to
deploy a Camel route that sends messages to a SIBus destination in WebSphere. We assume that connection factories and
queue objects are created using the API described in the [Programming to use JMS and messaging directly][1] page in the
WebSphere infocenter instead of looking them up using JNDI. This makes the configuration considerably simpler because
there is no need to create JNDI objects in the WebSphere configuration.

In this scenario, it's enough to install the SIB thin client and [we don't need the EJB thin client and IBM ORB][2] (as
would be the case in a scenario that uses JNDI lookups). The SIB thin client can be found in the `runtimes` directory of
the WebSphere installation. It is actually packaged as an OSGi bundle that can be deployed out of the box in ServiceMix.
This has been successfully tested with the client from WAS 7.0.0.25 and 8.5.5.0. Note that earlier 8.5 versions seem to
have some issues because they actually require the EJB thin client and IBM ORB.

To deploy the SIB thin client, simply use the following command in the ServiceMix console (Adapt the path and version as
necessary):

    osgi:install -s file:///opt/IBM/WebSphere/AppServer/runtimes/com.ibm.ws.sib.client.thin.jms_8.5.0.jar

The thin client should then appear in the list of deployed bundles as follows (Use the `osgi:list` command to display
that list):

    [ 182] [Active     ] [            ] [       ] [   80] IBM SIB JMS Thin Client (8.5.0)

We can now create and deploy a Camel route. We will do that using a Spring context file. As mentioned earlier, the
necessary connection factory and queue objects will be created using the
[`com.ibm.websphere.sib.api.jms.JmsFactoryFactory`][3] API. Since Spring supports creating beans using [static][4] and
[instance][5] factory methods (including [factory methods with parameters][6]) this can be done entirely in the Spring
configuration without writing any code.

The following sample configuration sets up a Camel route that reads files from a directory and sends them to a SIBus
destination:

~~~ markup
<beans xmlns="http://www.springframework.org/schema/beans"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.springframework.org/schema/beans
    http://www.springframework.org/schema/beans/spring-beans.xsd
    http://camel.apache.org/schema/spring
    http://camel.apache.org/schema/spring/camel-spring.xsd">

  <camelContext xmlns="http://camel.apache.org/schema/spring">
    <route>
      <from uri="file://test"/>
      <to uri="sib:queue:testQ"/>
    </route>
  </camelContext>
  
  <bean id="jmsFactoryFactory" class="com.ibm.websphere.sib.api.jms.JmsFactoryFactory"
        factory-method="getInstance"/>
  
  <bean id="testQ"
        factory-bean="jmsFactoryFactory" factory-method="createQueue">
    <constructor-arg>
      <value>queue://test</value>
    </constructor-arg>
  </bean>
  
  <bean id="testCF" factory-bean="jmsFactoryFactory" factory-method="createConnectionFactory">
    <property name="busName" value="test"/>
    <property name="providerEndpoints" value="isis:7276:BootstrapBasicMessaging"/>
    <property name="targetTransportChain" value="InboundBasicMessaging"/>
  </bean>
  
  <bean id="sib" class="org.apache.camel.component.jms.JmsComponent">
    <property name="connectionFactory" ref="testCF"/>
    <property name="destinationResolver">
      <bean class="org.springframework.jms.support.destination.BeanFactoryDestinationResolver"/>
    </property>
  </bean>
</beans>
~~~

To run this sample, change the queue name, bus name and the provider endpoint as required by your environment. Then copy
the Spring context to the `deploy` directory in your ServiceMix installation. This should create a `test` directory
where you can put the files to be sent to the SIBus destination.

[1]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.base.doc/info/aes/ae/tmj_pgmng.html
[2]: http://pic.dhe.ibm.com/infocenter/wasinfo/v8r5/topic/com.ibm.websphere.nd.multiplatform.doc/ae/rjj_jmsthcli_migrate602.html
[3]: http://pic.dhe.ibm.com/infocenter/wasinfo/v8r5/topic/com.ibm.websphere.javadoc.doc/web/apidocs/com/ibm/websphere/sib/api/jms/JmsFactoryFactory.html
[4]: http://docs.spring.io/spring/docs/3.0.x/reference/beans.html#beans-factory-class-static-factory-method
[5]: http://docs.spring.io/spring/docs/3.0.x/reference/beans.html#beans-factory-class-instance-factory-method
[6]: http://forum.spring.io/forum/spring-projects/container/48256-using-factory-beans-with-factory-method-parameters
