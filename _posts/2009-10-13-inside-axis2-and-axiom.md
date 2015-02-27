---
layout: post
title: "Inside Axis2 and Axiom: can somebody please clean up?"
category: tech
tags:
 - Axis2
 - Axiom
blogger: /2009/10/inside-axis2-and-axiom-can-somebody.html
disqus: true
---

Recently my attention got caught by a set of issues in Axis2 and Axiom that at first glance may seem unrelated, but when
considered together point towards an important design flaw in Axis2 and Axiom:

*   When MTOM or SwA is used, Axiom has the ability to offload the content of the attachments to temporary files. Axiom
    does this based on a threshold algorithm: it will first attempt to read the data into memory, and if the attachment
    is larger than a configurable threshold it will move that data and write the rest of the attachment to a temporary
    file. In addition, Axiom also implements deferred loading of attachments: the data is only read from the message
    when the code consuming the request tries to access the attachments. Of course this only works within the limits
    imposed by the fact that these attachments must be read sequentially from the underlying stream.
    
    Recently a user [reported][1] an issue related to MTOM when used in an asynchronous Web Service, i.e. a service that
    returns an acknowledgement (HTTP 202) and then processes the request asynchronously on a separate thread, sending
    back the response using a different channel. This is a feature that is fully [supported][2] by Axis2. However it
    turns out that when used with MTOM, the attachments get lost. The reason is that sending back the HTTP 202 response
    will discard the part of the request that has not yet been read. More precisely, `AbstractMessageReceiver`, the
    class implementing the asynchronous feature, calls `SOAPEnvelope#build()`, which makes sure that the SOAP part is
    fully read into memory, but fails to tell Axiom to read the attachments before control is handed back to the servlet
    container.
    
    I advised the user to fix this by replacing `build` by `buildWithAttachments`, which forces Axiom to fetch all
    attachments, or at least those that are referenced by `xop:Include` elements. However, this only led to the next
    problem, which is that `AxisServlet` calls `TransportUtils#deleteAttachments(MessageContext)` before the thread
    processing the request gets a chance to read the attachments. If the attachments have been loaded into memory, this
    is not an issue, but if they have been offloaded to temporary files, these files will be deleted at that moment.

*   An interesting aspect about the issue described above is that `AxisServlet` seems to be the only transport that uses
    `deleteAttachments`.  This means that the other transports would be affected by the opposite problem, i.e. instead
    of deleting temporary files too early (in the asynchronous case), they would not delete the temporary files at all.
    There is indeed an [open issue][3] in Axiom that describes this type of problem, but it is not clear if this occurs
    on the server side or client side (i.e. this bug report may actually refer to the last bullet below).
    
    It should be noted that since JMS is message based and doesn't use streams, the only other (commonly used) transport
    that would be impacted is the standalone HTTP transport, which is also used by Axis2's JAX-WS implementation when
    creating HTTP endpoints outside of a servlet container.

*   Axiom has another highly interesting feature called `OMSourcedElement`. Basically, this makes it possible to create
    an XML fragment that is not backed by an in-memory representation of the XML, but by some other data source. To make
    this work, every `OMSourcedElement` is linked to an `OMDataSource` instance that knows how to produce XML from the
    backing data. Many of the databindings provided by Axis2 rely on this feature. We also use it in Synapse for XSLT
    results if the stylesheet produces text instead of XML. Here again, if the result of the XSLT is too large, we
    offload it to a temporary file. In that case, we end up with an `OMSourcedElement`/`OMDataSource` that is backed by
    a temporary file. A [known issue][4] with this is that Synapse doesn't properly manage the lifecycle of these files,
    i.e. it is unable to delete them at the right moment. It actually relies on `File#deleteOnExit()` and on garbage
    collection, so that these temporary files will in general be kept longer than necessary.

*   Over the last year(s), there have been many reports about Axis2 leaking file descriptors or not closing HTTP
    connections. The issue came up again during the release process of Axis2 1.5.1, but it is still not entirely clear
    if the issue is now solved completely. What we know though is that at least part of the reports are in principle
    non-issues that are due the fact that the users didn't call `ServiceClient#cleanupTransport()` to properly release
    connections. However, as Glen [pointed out][5], the Axis2 Javadoc didn't mention that it is mandatory to call that
    method (well, until I [changed][6] that). Also, I didn't check yet what happens inside `cleanupTransport` if the
    service response is MTOM. It might be that here again, Axis2 fails to clean up temporary files (see second bullet).

What is interesting to notice is that when processing a message, any SOAP stack may in general be expected to only
acquire two kinds of resources that need explicit cleanup, namely network connections (or any other transport related
resources) and temporary files. Indeed, assuming that the SOAP stack itself will not interact with any other external
system, all other resources it acquires will be memory based and taken care of by the garbage collector (which of course
doesn't exclude memory leaks). Only the clients and service implementations (and maybe some particular modules/handlers)
will interact with external systems and acquire other resources requiring explicit cleanup (such as database
connections).

The fact that Axis2 (and/or Axiom) does a poor job when it comes to manage both types of resources is a strong
indication that there is an important design flaw that has yet to be addressed, or that it is lacking the appropriate
infrastructure and APIs required to guarantee correct lifecycle management of these resources.

[1]: http://markmail.org/message/2sfvhbnuntu3wnh2
[2]: https://issues.apache.org/jira/browse/AXIS2-2800
[3]: https://issues.apache.org/jira/browse/WSCOMMONS-506
[4]: https://issues.apache.org/jira/browse/SYNAPSE-212
[5]: http://markmail.org/message/cktqggaq75rulgfk
[6]: http://svn.apache.org/viewvc?view=rev&revision=748730

