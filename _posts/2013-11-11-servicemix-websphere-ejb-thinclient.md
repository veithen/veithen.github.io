---
layout: post
title: "Deploying the WebSphere EJB thin client in ServiceMix"
category: tech
tags:
 - OSGi
 - ServiceMix
 - WebSphere
blogger: /2013/11/servicemix-websphere-ejb-thinclient.html
disqus: true
description: >
 This article describes the problems encountered while attempting to deploy the WebSphere EJB thin client in
 ServiceMix and how to solve them.
---

In a [previous post][1] I explained how to install the SIB thin client into ServiceMix and use it in a Camel route. In
that post I used the [JmsFactoryFactory][2] API to create the JMS connection factory and the [Queue][3] object. However,
it should also be possible to configure them in WebSphere and look them up using JNDI. Performing that JNDI lookup
requires two additional libraries:

* The EJB thin client: `com.ibm.ws.ejb.thinclient_8.5.0.jar`

* The IBM ORB (Object Request Broker): `com.ibm.ws.orb_8.5.0.jar`

Both JARs can be found in the `runtimes` directory in the WebSphere installation. The latter is required only on non-IBM
JREs. In the following I will make the assumption that ServiceMix is running on an Oracle JRE and that we need both
JARs.

In a Java SE environment it is relatively straightforward to create a Camel configuration that uses the EJB thin client
to look up the necessary JMS resources from WebSphere. Here is a sample configuration that is basically equivalent to
the one used in the earlier post:

~~~ markup
<beans xmlns="http://www.springframework.org/schema/beans"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camel="http://camel.apache.org/schema/spring"
  xmlns:jee="http://www.springframework.org/schema/jee"
  xmlns:util="http://www.springframework.org/schema/util"
  xsi:schemaLocation="http://www.springframework.org/schema/jee
    http://www.springframework.org/schema/jee/spring-jee.xsd
    http://www.springframework.org/schema/beans
    http://www.springframework.org/schema/beans/spring-beans.xsd
    http://www.springframework.org/schema/util
    http://www.springframework.org/schema/util/spring-util.xsd
    http://camel.apache.org/schema/spring
    http://camel.apache.org/schema/spring/camel-spring.xsd">

  <camel:camelContext>
    <camel:route>
      <camel:from uri="file://test"/>
      <camel:to uri="sib:queue:jms/testQ"/>
    </camel:route>
  </camel:camelContext>
  
  <bean id="sib" class="org.apache.camel.component.jms.JmsComponent">
    <property name="connectionFactory">
      <jee:jndi-lookup resource-ref="false" jndi-name="jms/testQCF" environment-ref="env"
                       lookup-on-startup="false" expected-type="javax.jms.QueueConnectionFactory"/>
    </property>
    <property name="destinationResolver">
      <bean class="org.springframework.jms.support.destination.JndiDestinationResolver">
        <property name="jndiEnvironment" ref="env"/>
      </bean>
    </property>
  </bean>
  
  <util:properties id="env">
    <prop key="java.naming.factory.initial">com.ibm.websphere.naming.WsnInitialContextFactory</prop>
    <prop key="java.naming.provider.url">corbaloc:iiop:isis:2809</prop>
  </util:properties>
</beans>
~~~

The only requirements are:

* The three JARs (the SIB thin client, the EJB thin client and the ORB) must be in the classpath.

* A queue (`jms/testQ`) and a connection factory (`jms/testQCF`) must be configured in WebSphere. The provider endpoints
  must be set manually in the connection factory configuration. If you are using an existing connection factory,
  remember that specifying the provider endpoints is not required for applications running on WebSphere. Therefore it is
  possible (and even likely) that they are not set.

* The provider URL must point to the `BOOTSTRAP_ADDRESS` of the application server. If the JNDI resources are configured
  on a WebSphere cluster, use a `corbaloc` URL with multiple IIOP endpoints.

The challenge is now to make that configuration work on ServiceMix. We will make the following assumptions:

* The ServiceMix version is 4.5.3.

* We will use the libraries from WAS 8.5.5.0.

* The SIB thin client has already been deployed on ServiceMix using the instructions in my earlier post.

The remaining task is then to deploy the EJB thin client and the ORB. The EJB thin client is actually already packaged
as an OSGi bundle, while the ORB is packaged as a fragment that plugs into the EJB thin client. Therefore it should be
enough to install these two artifacts into ServiceMix. However, it turns out that this is not as simple as one would
expect.

## Problem 1: Missing required bundle `org.eclipse.osgi`

The first problem that appears is that after installing the EJB thin client and the ORB, an attempt to start the EJB
thin client bundle results in the following error:

    org.osgi.framework.BundleException: Unresolved constraint in bundle com.ibm.ws.ejb.thinclient [182]: Unable to resolve 182.0: missing requirement [182.0] module; (bundle-symbolic-name=org.eclipse.osgi)

Inspection of the manifests of these two artifacts indeed shows that they have the following directive:

    Require-Bundle: org.eclipse.osgi

Obviously, IBM packaged these artifacts for the Equinox platform (which is also used by WebSphere itself). Because
ServiceMix runs on Apache Felix, the bundle `org.eclipse.osgi` doesn't exist. Since the EJB thin client bundle has an
activator, it is likely that the purpose of this directive is simply to satisfy the dependency on the
`org.osgi.framework` package.

One possible solution for this problem would be to modify the manifests and replace the `Require-Bundle` directive by an
equivalent `Import-Package` directive. However, there is another solution that doesn't require modifying the IBM
artifacts. The idea is to create a "compatibility" bundle with the following manifest (and without any other content):

    Manifest-Version: 1.0
    Bundle-ManifestVersion: 2
    Bundle-Name: Equinox compatibility bundle
    Bundle-SymbolicName: org.eclipse.osgi
    Bundle-Version: 0.0.0
    Import-Package: org.osgi.framework
    Export-Package: org.osgi.framework

The `Export-Package` directive makes the `org.osgi.framework` package available to the EJB thin client bundle. Since the
compatibility bundle also imports that package, it will effectively be wired to the bundle that actually contains these
classes (which must exist in any OSGi runtime because the `org.osgi.framework` package is part of the core OSGi API).

## Problem 2: Constraint violation related to `javax.transaction.xa`

After installing the compatibility `org.eclipse.osgi` bundle, the EJB thin client bundle still fails to start. The error
message is now:

    org.osgi.framework.BundleException: Uses constraint violation. Unable to resolve module com.ibm.ws.ejb.thinclient [182.0] because it exports package 'javax.transaction.xa' and is also exposed to it from module org.apache.aries.transaction.manager [58.0] via the following dependency chain:
    
      com.ibm.ws.ejb.thinclient [182.0]
        import: (package=javax.jms)
         |
        export: package=javax.jms; uses:=javax.transaction.xa
      org.apache.geronimo.specs.geronimo-jms_1.1_spec [48.0]
        import: (package=javax.transaction.xa)
         |
        export: package=javax.transaction.xa
      org.apache.aries.transaction.manager [58.0]

Let's first decode what this actually means. The thin client bundle exports the `javax.transaction.xa` package, but it
doesn't import it. That implies that it can't be wired to the `javax.transaction.xa` package exported by the Aries
transaction manager bundle. At the same time the thin client imports the `javax.jms` package. The OSGi runtime choses
to wire that import to the Geronimo JMS API bundle. The `javax.jms` package contains classes that refer to classes in
the `javax.transaction.xa` package as part of their public API (see e.g. [`XASession`][4]). That is expressed by the
`uses` constraint (and a corresponding `Import-Package` directive) declared by the Geronimo bundle. However, the OSGi
runtime cannot wire that import back to the thin client because this would cause a circular dependency; it has to wire
it to the Aries bundle. That however would cause an issue because the thin client bundle now "sees" classes in the
`javax.transaction.xa` package loaded from two different bundles (itself and the Aries bundle). Therefore the OSGi
runtime refuses to resolve the thin client bundle.

That sounds like a tricky problem, but the solution is astonishingly simple: just remove the Geronimo JMS bundle!

    osgi:uninstall geronimo-jms_1.1_spec

After that you should restart ServiceMix so that it can properly rewire all bundles.

To see why this works, let's first note that in ServiceMix, the `javax.transaction.xa` package is configured for
[boot delegation][5] (see the `org.osgi.framework.bootdelegation` property in `etc/custom.properties`). That means that
classes in that package will always be loaded from the boot class loader, i.e. from the JRE. That in turn means that the
issue detected by the OSGi runtime will actually never occur: no matter how imports and exports for
`javax.transaction.xa` are formally wired together, it's always the classes from the JRE that will be loaded anyway. The
`uses:=javax.transaction.xa` declaration in the Geronimo bundle is therefore effectively irrelevant and could be
ignored.

Now recall that we made the assumption that the SIB thin client bundle is already installed. That bundle exports
`javax.jms` as well, but since it also imports that package, this export will not be used as long as the Geronimo JMS
bundle is installed. Let's have a closer look at the imports and exports of that bundle:

    karaf@root> osgi:headers com.ibm.ws.sib.client.thin.jms
    
    IBM SIB JMS Thin Client (181)
    -----------------------------
    Manifest-Version = 1.0
    Specification-Title = sibc.client.thin.bundle
    Eclipse-LazyStart = true
    Specification-Version = 8.5.0
    Specification-Vendor = IBM Corp.
    Ant-Version = Apache Ant 1.8.2
    Copyright = Licensed Materials - Property of IBM  5724-J08, 5724-I63, 5724-H88, 5724-H89, 5655-N02, 5733-W70  Copyright IBM Corp. 2007, 2009 All Rights Reserved.  US Government Users Restricted Rights - Use, duplication or disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
    Implementation-Version = WAS855.IM [gm1319.01]
    Implementation-Vendor = IBM Corp.
    Implementation-Title = sibc.client.thin.bundle
    Created-By = pxi3260sr10-20111208_01 (SR10) (IBM Corporation)
    
    Bundle-Vendor = IBM Corp.
    Bundle-Localization = plugin
    Bundle-RequiredExecutionEnvironment = J2SE-1.5
    Bundle-Name = IBM SIB JMS Thin Client
    Bundle-SymbolicName = com.ibm.ws.sib.client.thin.jms; singleton:=true
    Bundle-Classpath = .
    Bundle-Version = 8.5.0
    Bundle-ManifestVersion = 2
    
    Import-Package = 
     javax.jms,
     javax.resource,
     javax.resource.spi,
     javax.resource.spi.security,
     javax.management
    Export-Package = 
     com.ibm.websphere.sib.api.jms,
     com.ibm.ws.sib.api.jmsra.impl,
     com.ibm.ws.sib.api.jms.impl,
     javax.resource,
     javax.resource.spi,
     javax.resource.spi.security,
     javax.management,
     javax.jms;version=1.1.0
    Require-Bundle = 
     system.bundle

Interestingly, `javax.transaction.xa` isn't mentioned at all. Looking at the content of that bundle, one can also see
that it neither contains that package. This means that the SIB thin client was packaged with the assumption that
`javax.transaction.xa` is configured for boot delegation (while the Geronimo JMS API bundle doesn't rely on that
assumption). This is exactly what we need in our case. By removing the Geronimo bundle, we force the OSGi runtime to use
the `javax.jms` package exported by the SIB thin client, and that solves the issue.

The EJB thin client indeed starts properly after doing that:

    [ 181] [Active     ] [            ] [       ] [   80] IBM SIB JMS Thin Client (8.5.0)
    [ 182] [Active     ] [            ] [       ] [   80] WebSphere EJB Thin Client Runtime (8.0.0)
                                           Fragments: 183
    [ 183] [Resolved   ] [            ] [       ] [   80] WebSphere ORB Fragment (8.0.0)
                                           Hosts: 182
    [ 185] [Active     ] [            ] [       ] [   80] Equinox compatibility bundle (0.0.0)

## Problem 3: Inconsistent `javax.resource.spi` packages

We can now deploy the Spring configuration shown earlier. It deploys and starts successfully, but when trying to use it
(by dropping a file into the `test` directory), an error occurs. The relevant part of the stack trace is as follows:

    com.ibm.websphere.naming.CannotInstantiateObjectException: Exception occurred while the JNDI NamingManager was processing a javax.naming.Reference object. [Root exception is java.lang.NoClassDefFoundError: Ljavax/resource/spi/TransactionSupport$TransactionSupportLevel;]
      at com.ibm.ws.naming.util.Helpers.processSerializedObjectForLookupExt
      at com.ibm.ws.naming.util.Helpers.processSerializedObjectForLookup
      at com.ibm.ws.naming.jndicos.CNContextImpl.processBoundObjectForLookup
      at com.ibm.ws.naming.jndicos.CNContextImpl.processResolveResults
      at com.ibm.ws.naming.jndicos.CNContextImpl.doLookup
      at com.ibm.ws.naming.jndicos.CNContextImpl.doLookup
      at com.ibm.ws.naming.jndicos.CNContextImpl.lookupExt
      at com.ibm.ws.naming.jndicos.CNContextImpl.lookup
      at com.ibm.ws.naming.util.WsnInitCtx.lookup
      at com.ibm.ws.naming.util.WsnInitCtx.lookup
      at javax.naming.InitialContext.lookup
      at org.springframework.jndi.JndiTemplate$1.doInContext
      at org.springframework.jndi.JndiTemplate.execute
      at org.springframework.jndi.JndiTemplate.lookup
      at org.springframework.jndi.JndiTemplate.lookup
      at org.springframework.jndi.JndiLocatorSupport.lookup
      at org.springframework.jndi.JndiObjectLocator.lookup
      at org.springframework.jndi.JndiObjectTargetSource.getTarget
      ... 50 more
    Caused by: java.lang.NoClassDefFoundError: Ljavax/resource/spi/TransactionSupport$TransactionSupportLevel;
      at java.lang.Class.getDeclaredFields0
      at java.lang.Class.privateGetDeclaredFields
      at java.lang.Class.getDeclaredField
      at java.io.ObjectStreamClass.getDeclaredSUID
      at java.io.ObjectStreamClass.access$700
      at java.io.ObjectStreamClass$2.run
      at java.security.AccessController.doPrivileged
      at java.io.ObjectStreamClass.<init>
      at java.io.ObjectStreamClass.lookup
      at java.io.ObjectStreamClass.initNonProxy
      at java.io.ObjectInputStream.readNonProxyDesc
      at java.io.ObjectInputStream.readClassDesc
      at java.io.ObjectInputStream.readOrdinaryObject
      at java.io.ObjectInputStream.readObject0
      at java.io.ObjectInputStream.readObject
      at com.ibm.ejs.j2c.ConnectionFactoryBuilderImpl.getObjectInstance
      at javax.naming.spi.NamingManager.getObjectInstance
      at com.ibm.ws.naming.util.Helpers.processSerializedObjectForLookupExt
      ... 67 more

The error occurs when Spring attempts to look up the JMS connection factory from JNDI. It is actually caused by an issue
in the packaging of the IBM artifacts. The SIB and EJB thin clients both have `javax.resource.spi` in their
`Import-Package` and `Export-Package` directives. Since that package is not exported by any other bundle deployed on
ServiceMix, the OSGi runtime has two possibilities to resolve this situation: either it wires the `javax.resource.spi`
import from the EJB thin client to the SIB thin client bundle or vice versa. The problem is that the
`javax.resource.spi` package in the SIB thin client is incomplete: it contains fewer classes than the same package in
the EJB thin client. If the OSGi runtime selects the package from the SIB thin client bundle, then this leads to the
`NoClassDefFoundError` shown above.

One solution would be to change the order of installation of the two bundles in order to convince the OSGi runtime to
select the `javax.resource.spi` exported by the EJB thin client. However, this would be a very fragile solution. A
better solution is to add another bundle that exports the full `javax.resource.spi` package (without importing it). In
that case, the OSGi runtime only has a single possibility to wire the imports/exports for that package, namely to use
the version exported by the third bundle. Such a bundle actually exists in the WebSphere runtime and adding it to
ServiceMix indeed solves the problem:

    osgi:install file:///opt/IBM/WebSphere/AppServer/plugins/javax.j2ee.connector.jar

## Problem 4: Class loading issues related to the IBM ORB

After installing that bundle, you should restart ServiceMix to allow it to rewire the bundles properly. The JNDI lookup
of the connection factory now succeeds, but another failure occurs when Spring tries to create a connection:

    java.lang.NoClassDefFoundError: com/ibm/CORBA/iiop/ORB
      at java.lang.Class.forName0
      at java.lang.Class.forName
      at com.ibm.ws.util.PlatformHelperFactory.getBackupHelper
      at com.ibm.ws.util.PlatformHelperFactory.getPlatformHelper
      at com.ibm.ws.sib.trm.client.TrmSICoreConnectionFactoryImpl.<clinit>
      at java.lang.Class.forName0
      at java.lang.Class.forName
      at com.ibm.ws.sib.trm.TrmSICoreConnectionFactory.<clinit>
      at com.ibm.wsspi.sib.core.selector.SICoreConnectionFactorySelector.getSICoreConnectionFactory
      at com.ibm.wsspi.sib.core.selector.SICoreConnectionFactorySelector.getSICoreConnectionFactory
      at com.ibm.ws.sib.api.jmsra.impl.JmsJcaConnectionFactoryImpl.createCoreConnection
      at com.ibm.ws.sib.api.jmsra.impl.JmsJcaConnectionFactoryImpl.createCoreConnection
      at com.ibm.ws.sib.api.jmsra.impl.JmsJcaConnectionFactoryImpl.createConnection
      at com.ibm.ws.sib.api.jms.impl.JmsManagedConnectionFactoryImpl.createConnection
      at com.ibm.ws.sib.api.jms.impl.JmsManagedConnectionFactoryImpl.createConnection
      at sun.reflect.NativeMethodAccessorImpl.invoke0
      at sun.reflect.NativeMethodAccessorImpl.invoke
      at sun.reflect.DelegatingMethodAccessorImpl.invoke
      at java.lang.reflect.Method.invoke
      at org.springframework.aop.support.AopUtils.invokeJoinpointUsingReflection
      at org.springframework.aop.framework.JdkDynamicAopProxy.invoke
      at com.sun.proxy.$Proxy52.createConnection
      at org.springframework.jms.support.JmsAccessor.createConnection
      at org.springframework.jms.core.JmsTemplate.execute
      at org.apache.camel.component.jms.JmsConfiguration$CamelJmsTemplate.send
      at org.apache.camel.component.jms.JmsProducer.doSend
      at org.apache.camel.component.jms.JmsProducer.processInOnly
      at org.apache.camel.component.jms.JmsProducer.process
      ... 42 more
    Caused by: java.lang.ClassNotFoundException: com.ibm.CORBA.iiop.ORB not found by com.ibm.ws.sib.client.thin.jms
      at org.apache.felix.framework.ModuleImpl.findClassOrResourceByDelegation
      at org.apache.felix.framework.ModuleImpl.access$400
      at org.apache.felix.framework.ModuleImpl$ModuleClassLoader.loadClass
      at java.lang.ClassLoader.loadClass
      ... 70 more

Interestingly, if one installs the ORB fragment before the EJB thin client, then the Camel route fails much earlier
(during the creation of the `InitialContext`) with an error that is different, but related to the same
`com.ibm.CORBA.iiop.ORB` class:

    org.omg.CORBA.INITIALIZE: can't instantiate default ORB implementation com.ibm.CORBA.iiop.ORB  vmcid: 0x0  minor code: 0  completed: No
      at org.omg.CORBA.ORB.create_impl
      at org.omg.CORBA.ORB.init
      at com.ibm.ws.orb.GlobalORBFactory.init
      at com.ibm.ejs.oa.EJSORBImpl.initializeORB
      at com.ibm.ejs.oa.EJSClientORBImpl.<init>
      at com.ibm.ejs.oa.EJSClientORBImpl.<init>
      at com.ibm.ejs.oa.EJSORB.init
      ... 68 more
    Caused by: java.lang.ClassCastException: com.ibm.CORBA.iiop.ORB cannot be cast to org.omg.CORBA.ORB
      at org.omg.CORBA.ORB.create_impl
      ... 74 more

It is not clear whether this is a packaging issue in the IBM artifacts or a bug in Karaf/Felix. A solution is to add the
ORB to the endorsed libraries instead of installing it as an OSGi fragment. At first this might seem to be an ugly
workaround, but it actually makes sense. In the IBM JRE, these classes are part of the runtime libraries. By adding them
to the endorsed libraries one basically makes the Oracle JRE look a bit more like an IBM JRE.

Note that if we endorse the IBM ORB, then it is actually more naturally to use the JARs shipped with the IBM JRE instead
of the ORB bundle. These JARs can be found in the `java/jre/lib` directory in the WebSphere installation. We need the
following JARs from that directory: `ibmcfw.jar`, `ibmorb.jar` and `ibmorbapi.jar`. After copying these files to the
`lib/endorsed` directory in the ServiceMix installation, remove the ORB fragment:

    osgi:uninstall com.ibm.ws.orb

To make the ORB classes visible to the EJB thin client it is necessary to add `org.omg.*` and `com.ibm.*` to the
`org.osgi.framework.bootdelegation` property in `etc/custom.properties`. Note that this would also be necessary on an
IBM JRE. It means that the EJB thin client assumes that boot delegation is enabled for these packages.

## Problem 5: Missing classes from `com.ibm.ws.bootstrap`

After restarting ServiceMix, one now gets the following error:

    java.lang.NoClassDefFoundError: Could not initialize class com.ibm.ws.sib.trm.client.CredentialType

If one looks at the first occurrence of the error, one can see that the failure to initialize the `CredentialType` class
is caused by the following exception:

    java.lang.ClassNotFoundException: com.ibm.ws.bootstrap.BootHandlerException not found by com.ibm.ws.sib.client.thin.jms

Inspection of the content of the JMS thin client bundle shows that it contains the `com.ibm.ws.bootstrap` package, but
is missing the `BootHandlerException` class. That class is actually part of `lib/bootstrap.jar` in the WebSphere
runtime. We could add that JAR to the endorsed libraries, but in contrast to the ORB classes, this is not a natural
solution. It is actually enough to add it to the main class loader used to load Karaf. This can be done by copying the
JAR to the `lib` directory in the ServiceMix installation. Note that the classes will be visible to the SIB thin client
because we already added `com.ibm.*` to the boot delegation list before.

After adding `bootstrap.jar` and restarting ServiceMix, the sample route now executes successfully! Interestingly
`bootstrap.jar` is not required when executing the sample in a Java SE environment. This means that the issue occurs on
a code path that is only executed in an OSGi environment.

## Summary and conclusion

To summarize, the following steps are necessary to deploy the SIB and EJB thin clients as OSGi bundles in ServiceMix:

1.  Copy the following files from the WebSphere installation to the `lib/endorsed` directory:

    *   `java/jre/lib/ibmcfw.jar`

    *   `java/jre/lib/ibmorb.jar`

    *   `java/jre/lib/ibmorbapi.jar`

    On an IBM JRE, this step would be skipped.

2.  Copy `lib/bootstrap.jar` from the WebSphere installation to the `lib` directory.

3.  Add `org.omg.*` and `com.ibm.*` to the `org.osgi.framework.bootdelegation` property in `etc/custom.properties`.

4.  Create and install the Equinox compatibility bundle as described above.

5.  Install the following bundles from the WebSphere runtime:

    *   `plugins/javax.j2ee.connector.jar`

    *   `runtimes/com.ibm.ws.ejb.thinclient_8.5.0.jar`

    *   `runtimes/com.ibm.ws.sib.client.thin.jms_8.5.0.jar`

6.  Uninstall the `geronimo-jms_1.1_spec` bundle.

We have also seen that the SIB and EJB thin client bundles have several packaging issues. In particular they appear to
have been bundled under the assumption that a certain number of packages are configured for boot delegation. As already
argued in relation to the dependency on the `org.eclipse.osgi` bundle, the reason is probably that they were created for
Equinox as a target OSGi runtime. In fact, the assumptions made about boot delegation are compatible with the
[default configuration in Equinox][6]. What is more interesting is the fact that these packages also include
`com.ibm.ws.bootstrap`. That package is visible through boot delegation only in WebSphere, but the thin clients are
obviously not supposed to be deployed as OSGi bundles in WebSphere...

It should also be noted that the solution was only tested with a very simple scenario. It is possible that in more
complex scenarios, additional issues arise.

Finally, given the difficulties to install the thin clients as OSGi artifacts, one may reasonably argue that it might
actually be simpler to just repackage them...

[1]: /2013/11/03/servicemix-sibus.html
[2]: http://pic.dhe.ibm.com/infocenter/wasinfo/v8r5/topic/com.ibm.websphere.javadoc.doc/web/apidocs/com/ibm/websphere/sib/api/jms/JmsFactoryFactory.html
[3]: http://docs.oracle.com/javaee/1.4/api/javax/jms/Queue.html
[4]: http://docs.oracle.com/javaee/6/api/javax/jms/XASession.html
[5]: http://wiki.osgi.org/wiki/Boot_Delegation
[6]: http://wiki.eclipse.org/Equinox_Boot_Delegation