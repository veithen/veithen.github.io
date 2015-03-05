---
layout: post
title: "Extracting SOAP headers from a Web service response in Spring-WS"
category: tech
tags:
 - Spring-WS
disqus: true
description: >
 This article presents an elegant way to extract SOAP headers from Web service responses with the WebServiceTemplate in
 Spring-WS.
---

A frequently asked question in connection with [`WebServiceTemplate`][1] in Spring-WS is how to extract SOAP headers
from Web service responses. One possible answer is to use a [`ClientInterceptor`][2]. This makes sense because
one of the main use cases for interceptors is SOAP header processing. Client interceptors work well if the information
in the SOAP headers is processed out-of-band, i.e. if it is not returned to the caller of `WebServiceTemplate`.

However, things are different if the SOAP header data is simply to be returned to the application code so that it
can process that data together with the response payload. In that case, client interceptors are not a good choice.
The reason is that they have no simple way to send back data to the caller of `WebServiceTemplate`. They can store
data in the [`MessageContext`][3], but this data can't be accessed through `WebServiceTemplate`. One solution is
to store that data in the client interceptor itself and let the application code retrieve it from there. The drawback of that solution is
that this makes the interceptor stateful, which implies that the same `WebServiceTemplate` instance can no longer be
used concurrently for different requests.

A far simpler and elegant solution is to use a [`WebServiceMessageExtractor`][4] to process the SOAP response.
Consider e.g. a scenario that uses a marshaller/unmarshaller (e.g. JAXB2). Instead of calling
`marshalSendAndReceive`, one would use the following kind of code:

~~~ java
ResponseAndHeader responseAndHeader = webServiceTemplate.sendAndReceive(
    new WebServiceMessageCallback() {
      public void doWithMessage(WebServiceMessage message) throws IOException {
        MarshallingUtils.marshal(marshaller, request, message);
      }
    },
    new WebServiceMessageExtractor<ResponseAndHeader>() {
      public ResponseAndHeader extractData(WebServiceMessage message) throws IOException {
        SoapHeader header = ((SoapMessage)message).getSoapHeader();
        Iterator<SoapHeaderElement> it = header.examineHeaderElements(
            new QName("urn:test", "ResponseHeader"));
        return new ResponseAndHeader(
            it.hasNext() ? (ResponseHeader)unmarshaller.unmarshal(it.next().getSource())
                         : null,
            MarshallingUtils.unmarshal(unmarshaller, message));
        }
    });
~~~

Some additional explanations are in order here:

* `request`, `marshaller` and `unmarshaller` are variables/attributes visible in the scope where
  `sendAndReceive` is called. Their respective meaning should be obvious.

* The code uses the unmarshaller to process the header element (and unmarshal it into a `ResponseHeader`
  object in this example). This is typically what you want to do if you are already using an unmarshaller
  for the response payload, but it is easy to change the code to use some other technique to process the
  header.

* `MarshallingUtils` is a class provided by Spring-WS. It encapsulates the logic to marshal/unmarshall
  Web service message and makes that logic easily reusable. It is used by `WebServiceTemplate` itself,
  so that in that respect, the code shown above should behave exactly in the same way as `marshalSendAndReceive`.

* `ResponseAndHeader` is a simple custom class that stores the extracted header together with the
  response payload.

* The code uses a `WebServiceMessageCallback` to prepare the request. This is necessary because
  `WebServiceTemplate` doesn't have any method that uses a marshaller to prepare the request and a
  `WebServiceMessageExtractor` to extract the response.

Note that this approach leaves the `WebServiceTemplate` stateless, so that a single instance can be used for
concurrent requests. In addition, it requires less code than a custom `ClientInterceptor`.


[1]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/client/core/WebServiceTemplate.html
[2]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/client/support/interceptor/ClientInterceptor.html
[3]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/context/MessageContext.html
[4]: http://docs.spring.io/spring-ws/site/apidocs/org/springframework/ws/client/core/WebServiceMessageExtractor.html
