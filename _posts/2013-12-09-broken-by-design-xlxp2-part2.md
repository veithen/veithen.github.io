---
layout: post
title: "Broken by design: WebSphere's default StAX implementation (part 2)"
category: tech
tags:
 - WebSphere
 - StAX
blogger: /2013/12/broken-by-design-xlxp2-part2.html
disqus: true
---

A few weeks ago I posted an [article](/2013/10/11/broken-by-design-xlxp2.html) describing a vulnerability in WebSphere's default
StAX implementation (XLXP 2). In the meantime, IBM has acknowledged that the problem I described indeed causes a security issue
and they have produced a fix (see APAR PM99450). That fix introduces a new system property called
`com.ibm.xml.xlxp2.api.util.encoding.DataSourceFactory.bufferLoadFactor` described as follows:

> The value of the property is a non-negative integer which determines the minimum number of bytes (as a percentage) that will be
> loaded into each buffer. The percentage is calculated with the following formula: 1/2<sup>n</sup>.
>
> When the system property is not set its default value is 3. Setting the property to a lower value than the default can improve
> memory usage but may also reduce throughput.

In the last sentence IBM makes an interesting statement that raises some questions. Why would a change enabling the parser to read
data into an already reserved and partially filled buffer potentially cause a reduction in throughput? To answer that question, one
has to understand how IBM actually implemented that feature. Fortunately this doesn't require access to the source code. It is
enough to carefully examine the visible behavior of the parser, namely by feeding it with an `InputStream` that returns data in
small chunks and determining the correlation between read operations on that `InputStream` and events produced by the parser.

This reveals that the parser now uses the following algorithm: if after a first read operation the fill level determined by the
new system property is not reached, a second read request will be issued immediately and this is repeated until the required fill
level has been reached. The implication of this is that `XMLStreamReader.next()` may need to read much more data than what is
necessary to produce the next event. Stated differently, a call to `XMLStreamReader.next()` may block even if enough data is
available in the input stream.

As a matter of fact, this may have an impact on performance. Consider e.g. the processing of a SOAP message. With a well designed
StAX implementation, the SOAP stack will be able to start processing the SOAP header before the SOAP body has been received
completely. That is because a StAX implementation is expected to return an event as soon as enough data is available from the
underlying input stream. E.g. if the next event is `START_ELEMENT` then a call to `XMLStreamReader.next()` should return as soon
as the start tag for that element has been read from the stream. With the change introduced by PM99450, that assumption is no
longer true for XLXP 2.
