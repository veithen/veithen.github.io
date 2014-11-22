---
layout: post
title: Retrieving custom user attributes from LDAP in WebSphere
category: tech
tags: WebSphere
blogger: /2012/12/retrieving-custom-user-attributes-from.html
---

WebSphere can be configured to use LDAP as authentication mechanism. The implementation is fairly
complete and has support for SSL, connection reuse, multiple LDAP servers with failover as well as
mapping of client certificates to LDAP users. However, in many use cases applications also need
access to additional LDAP attributes (such as the email address or employee ID of the authenticated
user).

An obvious approach to get access to these attributes would be to make use of the `javax.naming.ldap`
API (or an equivalent API) inside the application or to write a custom JAAS login module that
performs the lookup using that API and adds the information to the `Subject` (from where they are
retrieved by the application). However, this approach would have several drawbacks:

* It leads to duplicate configuration because LDAP needs to be configured in WebSphere and the same
  configuration information also needs to be provided to the custom code.

* The LDAP support in WebSphere maintains a pool of LDAP connections and correctly performs failover
  if it detects that the primary LDAP server becomes unavailable. The custom code cannot take
  advantage of these features and needs to manage its own set of LDAP connections.

Ideally, instead of interacting with LDAP directly, the custom code should perform the lookup via
some API exposed by WebSphere in, so that it can reuse the existing LDAP client infrastructure
(including connection pooling, SSL support, failover, etc.). Unfortunately this is not feasible if
WebSphere is configured with a standalone LDAP registry as user registry. The reason is that although
the user registry (of type `com.ibm.ws.security.registry.ldap.LdapRegistryImpl` in that case) can be
looked up via JNDI, there is no public API allowing to access additional LDAP attributes.

However, LDAP can also be configured as a backend of a federated user repository. "Federated
repositories" is one of the four user registry types supported by WebSphere, the other three being
"Local operating system", "Standalone LDAP registry" and "Standalone custom registry". The "Federated
repositories" implementation originally comes from WebSphere Portal Server and is also called VMM
(Virtual Member Manager) or WIM (WebSphere Identity Manager). The main feature of this registry type
is its ability to [map entries from multiple individual user repositories into a single virtual repository][1].
It also exposes an API that gives access to additional user attributes. This is of course the feature
we are looking for.

Therefore a prerequisite to access custom LDAP attributes is to configure WebSphere security to use
VMM instead of the standalone LDAP registry. All features (SSL, pooling, failover, etc.) supported
by the standalone LDAP registry are also supported by VMM, and it is relatively straightforward to
create a VMM configuration that is equivalent to an existing standalone LDAP registry configuration.
In the following we will assume that this has been done and that VMM has been configured as the user
registry implementation.

We can now examine how to use the Virtual Member Manager API to get access to custom LDAP attributes.
We assume that the code will be integrated into a custom JAAS login module, but the ingredients are
the same if you want to integrate the code into your applications.

The first step is to get access to the Virtual Member Manager API. That API is defined by the 
[`Service`][2] interface. To get a reference to the VMM service in the local JVM, simply instantiate
[`LocalServiceProvider`][3] with the default constructor:

    Service service = new LocalServiceProvider();

The WebSphere infocenter document "[Getting the properties of an entity][4]" describes how to use the
`Service` API to look up the attributes of a user. As you can see in that documentation, this
operation requires as input the unique security name of the user, which looks as follows (Note that
this is not necessarily identical to the DN of the user in LDAP):

    uid=SalesManager,cn=users,dc=yourco,dc=com

This information can be retrieved from the [`WSCredential`][5] object which is put by one of the
WebSphere login modules into the shared state (i.e. the `Map` that is passed to the `initialize`
method of the `LoginModule`). The key to get the object from the map is defined in [`Constants`][6].
The unique security name is returned by the `getUniqueSecurityName` method.

The WebSphere infocenter document mentioned above shows how to specify the list of attributes to be
retrieved. It is important to note that these are not LDAP attribute names but names of properties
of the `PersonAccount` entity defined by VMM. By default, if a property is defined in the
`PersonAccount`, then it is mapped to the LDAP attribute with the same name. This also means that
in order to access an LDAP attribute, a corresponding property must be defined in the `PersonAccount`
entity. The WebSphere admin console doesn't allow to inspect or edit the properties of an entity.
Therefore this must be done with the help of wsadmin. To inspect the list of existing properties,
use the following command:

    $AdminTask getIdMgrPropertySchema { -entityTypeName PersonAccount }

You will see that the `PersonAccount` already defines properties for many of the attributes
typically used in LDAP. If you use custom attributes not defined in `PersonAccount`, you need to
[add them using the `addIdMgrPropertyToEntityTypes` admin task][7]. For example:

    $AdminTask addIdMgrPropertyToEntityTypes { -name ssn -dataType string -entityTypeNames PersonAccount }

Note that the `addIdMgrPropertyToEntityTypes` operation has parameters (`nsURI` and `nsPrefix`) to
specify a custom namespace for the property (to be used instead of the default
`http://www.ibm.com/websphere/wim` namespace). While it may seem a good idea to define custom
properties in a different namespace, the available documentation is not clear about how to query
such properties (they are not returned by the code shown in the infocenter document).

Also note that `AdminTask` doesn't define any operation to modify or remove properties. However,
this can be achieved by manipulating the `cells/`*`{cell_name}`*`/wim/model/wimxmlextension.xml`
document in the configuration repository.

The infocenter document mentioned above shows how to invoke the `Service#get` method. However, that
invocation will only work if the caller has sufficient privileges to access the user information.
If the code is executed inside an application, then the user has already been authenticated and the
call should succeed (because VMM grants each user access to his own information). On the other hand,
if the code is executed inside a login module, authentication is not yet complete and the call will
fail with a CWWIM2008E error. To avoid this, it is necessary to execute the code with additional
privileges. To do this, [execute the code with the identity of the server subject][8]:

    ContextManagerFactory.getInstance().runAsSystem(new PrivilegedExceptionAction<Void>()) {
        public Void run() {
            ...
            return null;
        }
    };

The infocenter document doesn't show how to programmatically extract the properties from the result
of the `Service#get` method. This is actually fairly easy, as shown in the following example:

    DataObject response = service.get(root);
    DataObject entity = (DataObject)response.get("entities[1]");
    String ssn = entity.getString("ssn");

Note that the `getString` method throws an `IllegalArgumentException` if the attribute is not present.

You can now use the retrieved attributes to enrich the `Subject` built by the chain of login modules
to make the information available to your applications.

## Further reading:

* To get an overview of the Virtual Member Manager:

  * [ftp://ftp.software.ibm.com/pub/info/wcm/Webcast-2009-03-26-WMMtoVMM.pdf](ftp://ftp.software.ibm.com/pub/info/wcm/Webcast-2009-03-26-WMMtoVMM.pdf)

  * [http://public.dhe.ibm.com/software/dw/websphere/CustomUserRepositoryFinal.pdf](http://public.dhe.ibm.com/software/dw/websphere/CustomUserRepositoryFinal.pdf)

* To get more information about JAAS login modules in WebSphere:
  [http://www.ibm.com/developerworks/websphere/techjournal/0508_benantar/0508_benantar.html](http://www.ibm.com/developerworks/websphere/techjournal/0508_benantar/0508_benantar.html)

[1]: http://www.ibm.com/developerworks/websphere/techjournal/0701_ilechko/0701_ilechko.html
[2]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.javadoc.vmm.doc/vmm/com/ibm/websphere/wim/Service.html
[3]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.javadoc.vmm.doc/vmm/com/ibm/websphere/wim/client/LocalServiceProvider.html
[4]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.wim.doc/gettingthepropertiesofanentity.html
[5]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.javadoc.doc/web/apidocs/com/ibm/websphere/security/cred/WSCredential.html
[6]: http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.javadoc.doc/web/spidocs/com/ibm/wsspi/security/auth/callback/Constants.html
[7]: http://www-01.ibm.com/support/docview.wss?uid=swg21573667
[8]: https://gist.github.com/3075970