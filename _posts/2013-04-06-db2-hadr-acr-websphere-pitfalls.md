---
layout: post
title: "Common pitfalls when using DB2, HADR, ACR and WebSphere"
category: tech
tags:
 - DB2
 - WebSphere
blogger: /2013/04/common-pitfalls-when-using-db2-hadr-acr.html
---

This article describes 5 common pitfalls to avoid when using DB2, HADR (High Availability and
Disaster Recovery), ACR (Automatic Client Reroute) and WebSphere Application Server together.
It is based on 3 years of (sometimes painful) experience with these technologies. Note that most
of what is described in this article also applies to application servers other than WebSphere.

## Pitfall 1: Missing alternate server name in the database configuration

To make use of ACR, one typically configures the `clientRerouteAlternateServerName` and
`clientRerouteAlternatePortNumber` properties on the data sources so that WebSphere knows about
the standby DB2 database(s). However, that information is actually only used for the very first
database connection. Information about the standby database(s) is also sent by DB2 during
connection establishment and the JDBC driver uses this information to update the data source at
runtime (discarding any previous value specified by the `clientRerouteAlternateServerName` and
`clientRerouteAlternatePortNumber` properties). The information sent by DB2 comes from a database
property that can be set using the `update alternate server for database` command. For ACR to work
properly, this property must be correctly configured on the primary and the standby databases. One
common pitfall is to omit that configuration or to specify incorrect values (e.g. to set the
alternate server name to the same value on both the primary and standby database).

## Pitfall 2: TCP keep-alive not tuned on client side

A typical failure scenario is a hardware or software crash of the host that runs the primary
database. In that case, TCP connections are not closed properly. For idle connections this is not
so much of a problem: WebSphere will eventually try to reuse them (if they are not discarded from
the connection pool before) and this will result in I/O errors fairly quickly because the OS doesn't
get acknowledgements for the packets sent to the peer.

Things are different for connections that are in use and waiting for data from DB2. The
corresponding threads are waiting for the completion of socket read operations. Since for
connections in that state the OS is not waiting for acknowledgements, the broken connections can
only be detected by the TCP keep-alive mechanism. The problem is that on most systems the keep-alive
timeout is extremely long (more than 1 hour). If the keep-alive parameters are not tuned correctly,
then in the event of a database failover this may result in a situation where some connections to
the failed server are purged fairly quickly while others hang for a long time.

An alternative solution for the problem might be to configure the `blockingReadConnectionTimeout`
property on the data source. However, this may have unexpected side effects on clients that execute
queries that take a long time to complete.

## Pitfall 3: TCP keep-alive not tuned on server side

When setting up HADR and ACR one generally focuses on what happens when a DB2 server goes down.
However, high availability is about making sure that things behave gracefully when **any** component
of the platform fails. One common pitfall is to neglect what happens when a database client fails.
If the failure is caused by a hardware or software crash of the host where the client is running,
then we end up again in a case where TCP connections are not closed properly. This time it is the
DB2 server that may need to wait for a very long time before the OS detects the broken connection.

Since on the server side a connection doesn't consume many resources, one might think that this is
not a problem. However, this neglects the fact that the connections may hold locks in the database.
These locks will not be released unless TCP keep-alive kicks in and forcefully closes the
connections. This may cause problems on the server that takes over the workload from the failed
client. There is one scenario where this systematically causes problems, namely a crash of a host
that runs an active SIBus messaging engine connected to the database. The reason is that to avoid
split brain scenarios, an active messaging engine always keeps a lock on a particular table in the
database. If that lock is not released, then the standby messaging engine will not be able to take
over.

## Pitfall 4: Overly aggressive ACR retry configuration

DB2 allocates an agent for each connection opened by a client. DB2 is expected to release that
agent as soon as the connection is closed (unless the connection is prematurely closed while the
agent is still executing a database operation, but this is not important for the discussion here).
Therefore the number of agents is expected to be the same as the number of open connections. This
means that when configuring the retry interval and maximum retry count for client reroute it
should be fine to use a small interval and/or a large number of retries. During a failover, frequent
retries would of course increase the load on the DB2 servers, but they should never cause resource
starvation because the JDBC driver ensures that connections are properly closed after each retry.

The problem is that the basic assumption underlying this argument is wrong. There are indeed cases
where DB2 fails to release the agent in a reasonable amount of time after the client has closed the
connection. This has been observed for databases that go into crash recovery. What this means for
ACR is that if something goes wrong during a database failover and one of the databases requires
crash recovery, then repeated connection attempts from the clients may lead to a huge increase in
the number of agents. This in turn may cause resource starvation (maximum number of agents reached;
exploding CPU load) to the point where the database administrator is no longer able to connect. If
this happens to you, then you should review the client reroute retry parameters in the data source
configurations.

## Pitfall 5: Connection failures during reconstruction of a standby database

After a database failover following an incident on the primary, one of the first actions to be done
by the database administrator will be to bring up the failed primary again and reintegrate it into
HADR as standby. In many cases it will be enough to let DB2 perform crash recovery on the database
and let HADR replay the transaction logs so that the database can catch up with the new primary.
However, in some cases this will not be possible or practicable. If something went badly wrong
during the crash, the DBA may need to restore the failed database from a backup. Even if crash
recovery is successful, the DBA may still choose to reconstruct the new standby from a backup
because HADR catch-up would take too much time. This will be the case for a busy database if HADR
was down for an extended period of time.

During the reconstruction of the new standby database, connection problems may sometimes arise. To
understand why this is so, it is important to review how ACR actually works. The JDBC driver will
trigger a reroute if a connection attempt fails at the TCP level or if the database responds with a
SQL1776N (The command cannot be issued on an HADR standby database) error. The problem is that
during the reconstruction operation, the database accepts connections, but responds with a SQL1117N
(A connection to or activation of database *name* cannot be made because of ROLL-FORWARD
PENDING) error. This will not trigger a reroute and applications may experience connection failures.

This problem occurs with data sources that are only used occasionally and that have not had a chance
to perform a reroute to the new primary before the DBA started the reconstruction. It may also occur
after a restart of a WebSphere server because the data sources will lose the information about the
current primary server and instead attempt to connect to the primary server specified in the data
source configuration, which may actually be the current standby server.

Although the situation described here seems to be a relatively common scenario, apparently it has
escaped the attention of the engineers at IBM. According to IBM support, the DB2 JDBC driver works
as designed and there is no defect. One possible way to work around that flaw is to reject client
connections during the reconstruction operation (e.g. using iptables if DB2 runs on Linux) in order
to force clients to trigger a reroute.

## Conclusions

In my experience a solution based on HADR together with ACR is a good choice when it comes to high
availability and disaster recovery (Note that I’m not talking about the cluster management solution
that IBM proposes to automate failover: TSA; that’s another story). However it doesn't give entire
satisfaction because it doesn't reach the level of robustness that one would expect for such a
critical part of the architecture.

One problem is the lack of good documentation about how to correctly tune the various parameters of
the operation system (TCP/IP stack) and the JDBC driver (timeouts and retry configuration). At some
point I worked with IBM consultants on that issue, and even they were unable to dig up some
comprehensive documentation about that subject.

The other problem is that IBM didn't get some details of the design right, as exemplified by the
last issue described above. For a component that is a crucial part of the high availability
architecture that is definitely a bad thing.
