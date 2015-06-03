---
layout: post
title: 'Apache Felix: "Stream handler unavailable due to: null"'
category: tech
tags:
 - OSGi
 - Pax Exam
disqus: true
description: >
 This article explains the meaning of the "java.lang.IllegalStateException: Stream handler unavailable due to: null"
 error that you may encounter when using Apache Felix.
---

When working with [Apache Felix][1], especially in combination with [Pax Exam][2], you may encounter the following
obscure error message:

    java.lang.IllegalStateException: Stream handler unavailable due to: null

The reason for this obscure and not very helpful error message is some sloppy error handling in
[`org.apache.felix.framework.URLHandlersStreamHandlerProxy#openConnection(URL)`][3]. The code in that method uses
reflection, but doesn't process `InvocationTargetException` correctly: instead of attempting to unwrap the exception and
rethrow the original exception, it will actually always wrap the `InvocationTargetException` in an
`IllegalStateException` without properly chaining the exceptions, resulting in the error message shown above
(In fact, `null` is the value of the message property of the `InvocationTargetException`).

To determine the root cause of the problem, set a breakpoint at the appropriate location in the method mentioned above
and run the code in a debugger.

One particular case where this error is triggered is in Pax Exam projects that are missing a dependency on
`pax-exam-link-mvn` or `pax-exam-link-assembly`. In this case, debugging reveals that the actual exception is:

    java.io.IOException: URL [META-INF/links/org.ops4j.pax.exam.link] could not be resolved from classpath

[1]: http://felix.apache.org/
[2]: https://ops4j1.jira.com/wiki/display/PAXEXAM4/Pax+Exam
[3]: http://grepcode.com/file/repo1.maven.org/maven2/org.apache.felix/org.apache.felix.framework/4.6.1/org/apache/felix/framework/URLHandlersStreamHandlerProxy.java#262
