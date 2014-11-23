---
layout: post
title: "WebSphere & ApacheDS quick setup guide"
category: tech
tags:
 - WebSphere
blogger: /2013/11/websphere-apacheds-quick-setup-guide.html
---

This article explains how to quickly configure WebSphere with [Apache Directory Server](http://directory.apache.org/apacheds/)
(ApacheDS) for LDAP authentication. We will use the ApacheDS server that comes packaged with
[Apache Directory Studio](http://directory.apache.org/studio/). This has the advantage that we only need a single tool to set
up the LDAP server and to populate the directory. Obviously the setup described here is not meant for production uses;
the goal is to rapidly create a working LDAP configuration for testing purposes. It is assumed that the reader is familiar
with configuring security (and in particular standalone LDAP registries) in WebSphere. No prior experience with
ApacheDS is required.

Start by setting up the LDAP server:

1.  [Download](http://directory.apache.org/studio/downloads.html), install and start Apache Directory Studio. The present
    article is based on version 2.0.0-M8, but the procedure should be similar for other versions.

1.  Using the "Servers" view, create a new ApacheDS server. There is no need to change the configuration; the default settings
    are appropriate for a test server. After the server has been created, start it:
    
    ![LDAP Servers](/assets/2013-11-16-websphere-apacheds-quick-setup-guide/servers.png)
    
1.  Create a connection to the server. To do this, right click on the server and choose "Create a Connection". The new
    connection should then appear in the "Connections" view. Double click on the connection to open it. You should see the
    following entries in the "LDAP Browser" view: `dc=example,dc=com`, `ou=config`, `ou=schema` and `ou=system`.

1.  Create two entries with RDN `ou=users` and `ou=groups` under `dc=example,dc=com`, both with object class `organizationalUnit`.

1.  For each test user, create an entry with object class `inetOrgPerson` under `ou=users`. For the RDN, use
    `uid=`*`<username>`*. Then fill in the `cn` and `sn` attributes (`cn` is the common name which should be the given name plus
    surname; `sn` is the surname alone). Also add a `userPassword` attribute.

1.  Under `ou=groups`, create as many groups as needed. There should be at least one group that will be mapped to the
    administrator role in WebSphere. For the object class, one can use either `groupOfNames` or `groupOfUniqueNames`. They are
    [more or less the same](http://www.openldap.org/lists/openldap-software/200308/msg00073.html), but the former is easier to
    set up, because Directory Studio will allow you to select members by browsing the directory. For the RDN, use
    `cn=`*`<groupname>`*. When using `groupOfNames`, Directory Studio will automatically open a dialog to select the first member
    of the group. Additional members can be defined by adding more values to the `member` attribute.

1.  Also define a `uid=admin` user that will be used as the primary administrative user in the WebSphere configuration. Since
    this is not a person, but a technical account, you can use the object classes `account` and `simpleSecurityObject` to create
    this user. Note that the `uid=admin` user doesn't need to be a member of any group.

The resulting LDAP tree should look as follows:

![Browser](/assets/2013-11-16-websphere-apacheds-quick-setup-guide/browser.png)

You can now configure the standalone LDAP registry in WebSphere. The settings are as follows:

* Primary administrative user name: `admin`

* Type of LDAP server: Custom

* Host/port: `localhost:10389` (if you kept the default configuration for ApacheDS, and the server is running on the same host)

* Base distinguished name: `dc=example,dc=com`

You also need to specify the following properties in the advanced LDAP user registry settings:

* User filter: `(&(uid=%v)(|(objectclass=inetOrgPerson)(objectclass=account)))`

* Group filter: `(&(cn=%v)(|(objectclass=groupOfNames)(objectclass=groupOfUniqueNames)))`

* User ID map: `*:uid`

* Group ID map: `*:cn`

* Group member ID map: `groupOfNames:member;groupOfUniqueNames:uniqueMember`
