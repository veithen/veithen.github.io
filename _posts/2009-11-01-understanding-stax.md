---
layout: post
title: "Understanding StAX: how to correctly use XMLStreamWriter"
category: tech
tags:
 - StAX
blogger: /2009/10/understanding-stax-how-to-correctly-use.html
disqus: true
description: >
 This describes the semantics of the setPrefix and setDefaultNamespace methods and presents the three usage patterns
 supported by XMLStreamWriter.
---

Note: This is a slightly edited version of a text that I wrote for the Axiom documentation. Some of the content is based
on a [reply posted by Tatu Saloranta on the Axiom mailing list][1]. Tatu is the main developer of the Woodstox project.

## Semantics of the `setPrefix` and `setDefaultNamespace` methods

The meaning and precise semantics of the `setPrefix` and `setDefaultNamespace` methods defined by `XMLStreamWriter` is
probably one of the most obscure aspects of the StAX specifications. As we will see later, even the people who wrote the
first version of IBM's StAX parser (called XLXP-J) failed to implement these two methods correctly. In order to
understand how these method are supposed to work, it is necessary to look at different parts of the specification (For
simplicity we will concentrate on `setPrefix`):

* The [Javadoc][2] of the `setPrefix` method.

* The table shown in the [Javadoc][3] of the `XMLStreamWriter` class in Java 6.

* Section 5.2.2, "Binding Prefixes" of the [StAX specification][4].

* The example shown in section 5.3.2, "XMLStreamWriter" of the StAX specification.

In addition, it is important to note the following facts:

* The terms *defaulting prefixes* used in section 5.2.2 of the specification and *namespace repairing* used in the
  Javadocs of `XMLStreamWriter` are synonyms.

* The methods writing namespace qualified information items, i.e. `writeStartElement`, `writeEmptyElement` and
  `writeAttribute` all come in two variants: one that takes a namespace URI and a prefix as arguments and one that only
  takes a namespace URI, but no prefix.

The purpose of the `setPrefix` method is simply to define the prefixes that will be used by the variants of the
`writeStartElement`, `writeEmptyElement` and `writeAttribute` methods that only take a namespace URI (and the local
name). This becomes clear by looking at the table in the `XMLStreamWriter` Javadoc. Note that a call to `setPrefix`
doesn't cause any output and it is still necessary to use `writeNamespace` to actually write the namespace declarations.
Otherwise the produced document will not be well formed with respect to namespaces.</p><p>The Javadoc of the `setPrefix`
method also clearly defines the scope of the prefix bindings defined using that method: a prefix bound using `setPrefix`
remains valid till the invocation of `writeEndElement` corresponding to the last invocation of `writeStartElement`.
While not explicitly mentioned in the specifications, it is clear that a prefix binding may be masked by another binding
for the same prefix defined in a nested element. (Interestingly enough, BEA's reference implementation didn't get this
aspect entirely right.)

An aspect that may cause confusion is the fact that in the example shown in section 5.3.2 of the specifications, the
calls to `setPrefix` (and `setDefaultNamespace`) all appear immediately before a call to `writeStartElement` or
`writeEmptyElement`. This may lead people to incorrectly believe that a prefix binding defined using `setPrefix` applies
to the next element written. This interpretation however is clearly in contradiction with the `setPrefix` Javadoc.

Note that early versions of IBM's XLXP-J were based on this incorrect interpretation of the specifications, but this has
been corrected. Versions conforming to the specifications support a special property called
`javax.xml.stream.XMLStreamWriter.isSetPrefixBeforeStartElement`, which always returns `Boolean.FALSE`. This allows to
easily distinguish the non conforming versions from the newer versions. Note that in contrast to what the usage of the
reserved `javax.xml.stream` prefix suggests, this is a vendor specific property that is not supported by other
implementations.

To avoid unexpected results and keep the code maintainable, it is in general advisable to keep the calls to `setPrefix`
and `writeNamespace` aligned, i.e. to make sure that the scope (in `XMLStreamWriter`) of the prefix binding defined by
`setPrefix` is compatible with the scope (in the produced document) of the namespace declaration written by the
corresponding call to `writeNamespace`. This makes it necessary to write code like this:

~~~ java
writer.writeStartElement("p", "element1", "urn:ns1");
writer.setPrefix("p", "urn:ns1");
writer.writeNamespace("p", "urn:ns1");
~~~

As can be seen from this code snippet, keeping the two scopes in sync makes it necessary to use the `writeStartElement`
variant which takes an explicit prefix. Note that this somewhat conflicts with the purpose of the `setPrefix` method;
one may consider this as a flaw in the design of the StAX API.

## The three `XMLStreamWriter` usage patterns

Drawing the conclusions from the previous section and taking into account that `XMLStreamWriter` also has a "namespace
repairing" mode, one can see that there are in fact three different ways to use `XMLStreamWriter`. These usage patterns
correspond to the three bullets in section 5.2.2 of the StAX specification:

1.  In the "namespace repairing" mode (enabled by the `javax.xml.stream.isRepairingNamespaces` property), the writer
    takes care of all namespace bindings and declarations, with minimal help from the calling code. This will always
    produce output that is well-formed with respect to namespaces. On the other hand, this adds some overhead and the
    result may depend on the particular StAX implementation (though the result produced by different implementations
    will be equivalent).
    
    In repairing mode the calling code should avoid writing namespaces explicitly and leave that job to the writer.
    There is also no need to call `setPrefix`, except to suggest a preferred prefix for a namespace URI. All variants of
    `writeStartElement`, `writeEmptyElement` and `writeAttribute` may be used in this mode, but the implementation can
    choose whatever prefix mapping it wants, as long as the output results in proper URI mapping for elements and
    attributes.

2.  Only use the variants of the writer methods that take an explicit prefix together with the namespace URI. In this
    usage pattern, `setPrefix` is not used at all and it is the responsibility of the calling code to keep track of
    prefix bindings.

    Note that this approach is difficult to implement when different parts of the output document will be produced by
    different components (or even different libraries). Indeed, when passing the `XMLStreamWriter` from one method or
    component to the other, it will also be necessary to pass additional information about the prefix mappings in scope
    at that moment, unless the it is acceptable to let the called method write (potentially redundant) namespace
    declarations for all namespaces it uses.

3.  Use `setPrefix` to keep track of prefix bindings and make sure that the bindings are in sync with the namespace
    declarations that have been written, i.e. always use `setPrefix` immediately before or immediately after each call
    to `writeNamespace`. Note that the code is still free to use all variants of `writeStartElement`,
    `writeEmptyElement` and `writeAttribute`; it only needs to make sure that the usage it makes of these methods is
    consistent with the prefix bindings in scope.
    
    The advantage of this approach is that it allows to write modular code: when a method receives an `XMLStreamWriter`
    object (to write part of the document), it can use the namespace context of that writer (i.e. `getPrefix` and
    `getNamespaceContext`) to determine which namespace declarations are currently in scope in the output document and
    to avoid redundant or conflicting namespace declarations. Note that in order to do so, such code will have to check
    for an existing prefix binding before starting to use a namespace.

[1]: http://markmail.org/message/olsdl3p3gciqqeob
[2]: http://java.sun.com/webservices/docs/1.5/api/javax/xml/stream/XMLStreamWriter.html#setPrefix(java.lang.String, java.lang.String)
[3]: http://java.sun.com/javase/6/docs/api/javax/xml/stream/XMLStreamWriter.html
[4]: http://jcp.org/en/jsr/detail?id=173