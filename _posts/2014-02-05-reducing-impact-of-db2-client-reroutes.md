---
layout: post
title: "Reducing the impact of DB2 client reroutes on applications deployed on WebSphere"
category: tech
tags:
 - DB2
 - WebSphere
blogger: /2014/02/reducing-impact-of-db2-client-reroutes.html
disqus: true
description: >
 This post analyzes how WebSphere and applications deployed on WebSphere react to a client reroute and what can be done
 to minimize the impact of a failover.
---

In a [previous blog post][1] I discussed a couple of common pitfalls when using HADR and automatic client reroute with
DB2 and WebSphere. In the present post I will analyze another closely related topic, namely how WebSphere and
applications deployed on WebSphere react to a client reroute and what can be done to minimize the impact of a failover.

There are a couple of things one needs to be aware of in order to analyze these questions:

*   The failover of a database always causes all [active transactions on that database to be rolled back][2]. The
    fundamental reason is that HADR doesn't replicate locks to the standby database, as mentioned [here][3]. Note that,
    on the other hand, HADR does ship log records for uncommitted operations (which means that transactions that are
    rolled back on the primary also cause a roll back on the standby). The standby therefore has enough information to
    reconstruct the data in an active transaction, but the fact that locks are not replicated implies that it cannot
    fully reconstruct the state of the active transactions during a failover. It therefore cannot allow these
    transactions to continue and is forced to perform a rollback.

*   By default, when the JDBC driver performs a client reroute after detecting that a database has failed over, it will
    trigger a `com.ibm.db2.jcc.am.ClientRerouteException` (with `ERRORCODE=-4498` and `SQLSTATE=08506`). This exception
    will be mapped by WebSphere to a `com.ibm.websphere.ce.cm.StaleConnectionException` before it is received by the
    application.

    Note that this occurs during the first attempt to reuse an existing connection after the failover. Since connections
    are pooled, there may be a significant delay between the failover and the occurrence of the
    `ClientRerouteException`/`StaleConnectionException`.

The correct way to react to a `ClientRerouteException`/`StaleConnectionException` would therefore be to reexecute the
entire transaction. Obviously there is a special case, namely a reroute occurring while attempting to execute the first
query in a transaction. In this situation, only a single operation needs to be reexecuted. Note that this is actually
the most common case because it occurs for transactions started after the failover, but that attempt to reuse a
connection established before the failover. Typically this is more likely than a failover in the middle of a transaction
(except of course on very busy systems or applications that use long running transactions).

The JDBC data source can be configured to automatically handle that special case. This feature is called
*seamless failover*. The [DB2 documentation][4] describes the conditions that need to be satisfied for seamless failover
to be effective:

>   If seamless failover is enabled, the driver retries the transaction on the new server, without notifying the
>   application.
>
>   The following conditions must be satisfied for seamless failover to occur:
>
>   *   The `enableSeamlessFailover` property is set to `DB2BaseDataSource.YES`. [...]
>   *   The connection is not in a transaction. That is, the failure occurs when the first SQL statement in the
>       transaction is executed.
>   *   There are no global temporary tables in use on the server.
>   *   There are no open, held cursors.

This still leaves the case where the failover occurs in the middle of a transaction. The DB2 documentation has an
[example][5] that shows how an application could react in this situation by reexecuting the entire transaction. However,
the approach suggested by that example is not realistic for real world applications. There are multiple reasons for that:

*   It requires lot of boilerplate error handling code to be added to the application. That code would be much more
    complex than what is suggested by the example. Just to name a few complications that may occur: reuse of the same
    data access code in different transactions, container managed transactions, distributed transactions, the option to
    [join an existing transaction][6], transactions started by and imported from remote clients, etc.

*   Writing and maintaining that code is very error-prone. It is very easy to get it wrong, so that instead of
    reexecuting the current transaction, the code would only partially reexecute the transaction or reexecute queries
    that are part of a previous transaction that has already been committed. Since the code is not executed during
    normal program flow, such bugs will not be noticed immediately.

*   It is virtually impossible to test this code. One would have to find a way to trigger or simulate a database
    failover at a well defined moment during code execution. One would then have to apply this technique to every
    possible partially executed transaction that can occur in the application. This is simply not realistic.

A more realistic option would be to handle this at the framework level. E.g. it is likely that Spring could be set up or
extended to support automatic transaction reexecution in case of a client reroute. If this support is designed carefully
and tested thoroughly, then one can reasonably assume that it just works transparently for any transaction, removing the
need to test it individually for every transaction.

However, before embarking on this endeavor, you should ask yourself if the return on investment is actually high enough.
You should take into account the following aspects in your evaluation:

*   There may be multiple frameworks in use in your organization (e.g. EJB and Spring). Automatic transaction
    reexecution would have to be implemented for each of these frameworks separately. For some frameworks, it may be
    impossible to implement this in a way that is transparent for applications.

*   Database failovers are expected to be rare events. If seamless failover is enabled, then only transactions that are
    active at the time of the failover will be impacted. This means that the failure rate may be very low.

*   When the primary DB2 instance goes down because of a crash, it will take some time before the standby takes over.
    Even if the application successfully reexecutes the transaction, the client of the application may still receive an
    error because of timeouts. On the other hand, in case of a manual takeover for maintenance reasons, one can usually
    reduce the impact on clients by carefully scheduling the takeover.

*   There are lots of reasons why a client request may fail, and database failovers are only one possible cause. Other
    causes include application server crashes and network issues. It is likely that implementing automatic transaction
    reexecution would reduce the overall failure rate only marginally. It may actually be more interesting to implement
    a mechanism that retries requests on the client side for any kind of failure.

*   Message driven beans already provide a retry mechanism that is transactionally safe. In some cases this may be a
    better option than implementing a custom solution.

The conclusion is that while it is in general a good idea to enable seamless failover, in most cases it is not worth
trying to intercept `ClientRerouteException`/`StaleConnectionException` and to automatically reexecute transactions.

[1]: /2013/04/06/db2-hadr-acr-websphere-pitfalls.html
[2]: https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/DB2HADR/page/HADR%20takeover?section=What_happens_during_a_takeover
[3]: http://www.ibm.com/developerworks/data/library/techarticle/dm-1205hadrstandby/
[4]: http://pic.dhe.ibm.com/infocenter/db2luw/v10r5/topic/com.ibm.db2.luw.apdv.java.doc/src/tpc/imjcc_c0056175.html
[5]: http://pic.dhe.ibm.com/infocenter/db2luw/v10r5/topic/com.ibm.db2.luw.admin.ha.doc/doc/r0011978.html
[6]: http://docs.oracle.com/javaee/6/api/javax/ejb/TransactionAttributeType.html#REQUIRED
