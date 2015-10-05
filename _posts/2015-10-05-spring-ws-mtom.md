---
layout: post
title: "Broken by design: MTOM processing in Spring-WS"
category: tech
tags:
 - Spring-WS
 - Broken by design
disqus: true
description: >
 This article identifies the common root cause of several known issues related to MTOM/XOP processing in Spring-WS
 and discusses a possible long term solution.
twitter_text: "#BrokenByDesign: #MTOM processing in #SpringWS"
---

## Introduction

There are several known issues related to [MTOM](http://www.w3.org/TR/soap12-mtom/) (or more generally
[XOP](http://www.w3.org/TR/xop10/)) processing in Spring-WS. This article identifies the common root cause
of these issues and discusses a possible (long term) solution.

Since Spring-WS has two implementations, one based on SAAJ and another one based on
[Apache Axiom](http://ws.apache.org/axiom/) let's start by examining how these two libraries handle
MTOM.

## MTOM processing in SAAJ

SAAJ doesn't perform any kind of XOP decoding (beyond MIME processing): `xop:Include` elements are simply represented as
`SOAPElement` instances in the DOM tree, which means that it is the responsibility of the
application code to perform XOP decoding. The only support for XOP/MTOM in SAAJ is provided by the
[`SOAPMessage#getAttachment(SOAPElement)`][1] method which can be used to retrieve the
`AttachmentPart` referenced by an `xop:Include` element.

## MTOM processing in Apache Axiom

Apache Axiom has a well defined XOP processing model (at least since version 1.2.9 which fixed
[AXIOM-122](https://issues.apache.org/jira/browse/AXIOM-122) and
[AXIOM-255](https://issues.apache.org/jira/browse/AXIOM-255)):

*   XOP decoding is performed by Axiom and XOP unaware code will simply see base64 encoded data wherever `xop:Include`
    elements appeared in the original message:
    
    *   In the object model created by Axiom, `xop:Include` elements are represented as [`OMText`][2] nodes (which
        produce base64 encoded data on demand, but internally store references to MIME parts).
    
    *   `XMLStreamReader` instances returned by [`getXMLStreamReader`][3] will produce `CHARACTERS` events
        for `xop:Include` elements (and perform base64 encoding on demand).
    
    *   `SAXSource` instances returned by [`getSAXSource`][4] will produce [`characters`][5] events
        for `xop:Include` elements.

*   At the same time, Axiom provides APIs that allow XOP aware code to access the binary data in an optimized way:

    *   `OMText` has a [`getDataHandler`][6] method to retrieve the binary data directly from the MIME part.
    
    *   `XMLStreamReader` instances returned by `getXMLStreamReader` implement an [extension][7] that allows application
        code to check whether a `CHARACTERS` event corresponds to binary data and to retrieve that binary data if
        applicable.

*   Axiom also has an [API][8] to get an XOP encoded `XMLStreamReader` which can be used when integrating Axiom based
    code with libraries that are XOP aware, but that don't support the Axiom API directly. A good example for this is
    JAXB2.

This is the optimal processing model because XOP unaware code will just work (although not necessarily with the best
performance) and it is still possible to write code that processes MTOM messages in a highly optimized way
(including full [streaming support](https://issues.apache.org/jira/browse/AXIOM-377) for binary data, introduced
in Axiom 1.2.13).

## What's the problem with Spring-WS?

The problem with Spring-WS is that in contrast to SAAJ and Axiom, it doesn't have a well defined MTOM processing model.
Namely, it is unspecified whether the [`getPayloadSource`][9] method defined by the `WebServiceMessage` interface should
return a `Source` object representing XOP decoded or encoded data. This is not just a missing detail in the documentation;
the problem is that this method is both implemented and used inconsistently in Spring-WS itself:

*   The SAAJ based implementation returns a `DOMSource` that points directly to the relevant part of the DOM tree
    produced by SAAJ, i.e. it returns **XOP encoded data**.

*   The Axiom based implementation returns a `Source` constructed from the `XMLStreamReader` instance returned by
    Axiom's `getXMLStreamReader` method, i.e. it returns **XOP decoded data**.

*   [`MarshallingUtils`][12] (which is used by [`MarshallingPayloadMethodProcessor`][13]) passes the return value
    of `getPayloadSource` to an [XOP aware API][14], i.e. it assumes that it represents **XOP encoded data**. That
    assumption is not correct if the Axiom based implementation is used, with as consequence that binary data
    is retrieved from Axiom as base64 encoded strings, only to be immediately decoded again by the unmarshaller,
    resulting [in poor performance and out of memory conditions for large
    attachments](http://stackoverflow.com/questions/32784682/mtom-attachment-streaming-into-a-channel).

*   [`PayloadValidatingInterceptor`][10] basically passes the return value of `getPayloadSource` directly to a
    [`javax.xml.validation.Validator`][11]. Since that API is not XOP aware, this means that
    `PayloadValidatingInterceptor` implicitly assumes that `getPayloadSource` returns **XOP decoded data**.
    For SAAJ that assumption is incorrect, which is the root cause for [SWS-242](https://jira.spring.io/browse/SWS-242).

## Possible solutions

In the previous section we have seen that the problems with MTOM processing in Spring-WS are caused by a flaw in the
design of the Spring-WS API. There is therefore no easy fix and a proper solution will require changes to the API.
Namely the `getPayloadSource` method (or a new, overloaded version of that method) should have an argument that allows
the caller to specify whether it expects it to return XOP encoded or decoded data, i.e. whether it is prepared to handle
`xop:Include` elements or expects to get base64 encoded data instead.

That new API would be easy to implement in the Axiom based implementation because Axiom already provides the necessary
APIs for that. The case is less trivial for SAAJ because that API doesn't perform any XOP decoding itself. A solution
would be to let the SAAJ based implementation return a `SAXSource` or `StAXSource` that performs the necessary
transformations if the caller requests an XOP decoded `Source`. Note that this would only be necessary if the message
is actually an MTOM message. In all other cases, the implementation could simply return a `DOMSource` as usual.

Note that the problem related to MTOM is not the only issue with the `getPayloadSource` method. There are at least two
other issues that could be addressed at the same time as the XOP decoding problem:

*   The documentation of the `getPayloadSource` specifies the following:

    > Depending on the implementation, [the payload source] can be retrieved multiple times, or just a single time.

    This doesn't make sense. The decision whether the payload is to be preserved (so that a subsequent call succeeds)
    or not should not be left to the implementation. Instead, this should be specified by the caller.
    E.g. if the calling code intents to replace the payload with something else (as would be the case for
    [`PayloadTransformingInterceptor`][15]), then it knows that there is no need to preserve the original payload.
    On the other hand, interceptors such as `PayloadValidatingInterceptor` must preserve the original payload and should
    be able to instruct `getPayloadSource` to take care of that.

*   In the current Spring-WS API, it is completely up to the implementation of the `getPayloadSource` method to decide
    which type of `Source` object (`DOMSource`, `SAXSource` or `StAXSource`) to return. However, that choice may have
    implications for the performance of the calling code because the "wrong" choice may require the caller to perform
    additional conversion to get the representation it needs. To avoid this problem, the caller should be given the
    opportunity to specify a preference for the type of the returned `Source`.

[1]: http://docs.oracle.com/javase/7/docs/api/javax/xml/soap/SOAPMessage.html#getAttachment(javax.xml.soap.SOAPElement)
[2]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/om/OMText.html
[3]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/om/OMContainer.html#getXMLStreamReader()
[4]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/om/OMContainer.html#getSAXSource(boolean)
[5]: http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html#characters(char[], int, int)
[6]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/om/OMText.html#getDataHandler()
[7]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/ext/stax/datahandler/DataHandlerReader.html
[8]: https://ws.apache.org/axiom/apidocs/org/apache/axiom/util/stax/xop/XOPUtils.html#getXOPEncodedStream(javax.xml.stream.XMLStreamReader)
[9]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/WebServiceMessage.html#getPayloadSource()
[10]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/soap/server/endpoint/interceptor/PayloadValidatingInterceptor.html
[11]: https://docs.oracle.com/javase/7/docs/api/javax/xml/validation/Validator.html
[12]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/support/MarshallingUtils.html
[13]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/server/endpoint/adapter/method/MarshallingPayloadMethodProcessor.html
[14]: http://docs.spring.io/spring/docs/current/javadoc-api/org/springframework/oxm/mime/MimeUnmarshaller.html
[15]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/server/endpoint/interceptor/PayloadTransformingInterceptor.html
