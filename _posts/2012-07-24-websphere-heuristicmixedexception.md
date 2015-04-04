---
layout: post
title: "How to deal with HeuristicMixedException in WebSphere?"
category: tech
tags:
 - WebSphere
blogger: /2012/07/how-to-deal-with-heuristicmixedexceptio.html
disqus: true
description: >
 Understand under which conditions a HeuristicMixedException may occur on WebSphere and learn how to deal with it.
---

During an incident such as a database issue, applications deployed on WebSphere may sometimes get
exceptions of type `HeuristicMixedException`. The meaning of this exception is defined by the JTA
specification:

> Thrown to indicate that a heuristic decision was made and that some relevant updates have been
committed while others have been rolled back.

The XA Specification describes the concept of a "heuristic decision" as follows:

> Some RMs [Resource Managers] may employ heuristic decision-making: an RM that has prepared to
commit a transaction branch may decide to commit or roll back its work independently of the TM
[Transaction Manager]. It could then unlock shared resources. This may leave them in an
inconsistent state. When the TM ultimately directs an RM to complete the branch, the RM may respond
that it has already done so. The RM reports whether it committed the branch, rolled it back, or
completed it with mixed results (committed some work and rolled back other work).

This means that a transaction with a heuristic outcome may lead to data integrity problems because
some resources have been rolled back while others have been committed, i.e. the transaction is no
longer atomic. However, a `HeuristicMixedException` doesn't necessarily mean that this actually
occurred, and in many cases, the transaction is actually rolled back successfully.

One interesting case where `HeuristicMixedException` exceptions are often seen in WebSphere is a
distributed transaction where one of the participating resources is a SIBus messaging engine and
that cannot be completed because of an issue that affects the message store.

It is important to know that a messaging engine typically doesn't persist messages immediately, but
only when the transaction is committed. If there is a problem with the message store, then the
transaction manager will get an exception from the SIBus resource adapter during the prepare phase.
This will generate log messages of type J2CA0027E (An exception occurred while invoking prepare on
an XA Resource Adapter) and WTRN0046E (An attempt by the transaction manager to call prepare on a
transactional resource has resulted in an error. The error code was XAER_RMFAIL).

When the transaction manager gets the exception from the resource adapter, it will decide to roll back
the transaction. However, it doesn't know whether the resource that produced the exception has
actually completed the prepare phase or not. From the point of view of the transaction manager, it
could be that the prepare phase completed successfully and that the exception was caused by a
communication failure just afterwards. Therefore the transaction manager needs to query the resource
manager to check the status of the transaction branch and to instruct it to roll back the prepared
transaction if necessary. WebSphere will attempt that periodically until the resource manager is
available again. Each unsuccessful attempt will result in a WTRN0049W (An attempt by the transaction
manager to call rollback on a transactional resource has resulted in an XAER_RMFAIL error) message
being logged. While WebSphere is attempting to complete the rollback, the transaction will also appear
in the list of retry transactions in the admin console:

![Retry transactions in the admin console](retry-transactions.gif)

If the error is not transient, then completing the transaction may take a significant amount of time.
For obvious reasons, WebSphere cannot simply block the application until the status of the transaction
is resolved; at some point it has to return control to the application. The problem is that it cannot
report the transaction as rolled back (by throwing a `HeuristicRollbackException` or a
`RollbackException`) because from the point of view of the transaction manager, part of the
transaction may have been prepared. Reporting the transaction as rolled back would be incorrect
because it may cause the application to attempt to reexecute the transaction, although reexecuting
a transaction that has been partially prepared is likely to fail.

WebSphere internally puts this kind of transaction into status 11, which is the numeric value for
`HEURISTIC_HAZARD` (see [this](http://pic.dhe.ibm.com/infocenter/wasinfo/v7r0/topic/%20com.ibm.websphere.nd.doc/info/ae/ae/tjta_manage_scripts.html)
 documentation):
 
![Heuristic transactions in the admin console](heuristic-transactions.gif)
 
The `HEURISTIC_HAZARD` status means that "The transaction branch **may** have been heuristically
completed". Unfortunately, JTA defines no exception corresponding to `HEURISTIC_HAZARD` that could
be thrown by the commit method in `UserTransaction`. Therefore WebSphere uses the closest match,
which in this case is `HeuristicMixedException`.
