---
layout: post
title: "XML schema oddity: covariant literals (part 1)"
category: tech
tags:
 - XML
blogger: /2009/10/xml-schema-oddity-covariant-literals.html
disqus: true
---

If you look at the 19 primitive types defined by the [second part][1] of the XML Schema specification, you may notice
that one of them, namely `QName`, has a very particular feature that distinguishes it from the 18 other types: there is
no functional mapping between its lexical space and its value space.

The value space of a type describes the set of possible values for that type and is a semantic concept. For example, the
value space of the `boolean` type has two element: true and false. The lexical space on the other hand is the set of
possible literals for that type. It is a syntactic concept and describes the possible ways in which the values of the
type may appear in the XML document. E.g. the lexical space the `boolean` type has four elements: `0`, `1`, `true` and
`false`. For a given type, the existence of a functional mapping between the lexical space and the value space means
that for every literal, there is one and only one value that corresponds to that literal. This implies that if for
example the type is used to describe an XML element, it is sufficient to know the text inside that element to
unambiguously determine the value.

The `QName` type doesn't have this property because its value space is the set of tuples {namespace name, local part},
while its lexical space is defined by the production `(Prefix ':')? LocalPart`. Therefore, a `QName` literal can only be
translated into a `QName` value if the context in which the literal appears is known. More precisely, it is necessary to
know the namespace context, i.e. the set of namespace declarations in scope for the context where the `QName` is used.

Another interesting property of the schema type system is that none of the primitive types has a lexical space that is
disjoint from the lexical spaces of all other primitive types. The proof is trivial: the lexical space of any simple
type is in fact a subset of the lexical space of the `string` type. This implies that without knowledge of the schema,
it is not possible to detect usages of `QName` in an instance document.

Why is all this important? Well, the consequence is that a transformation of an XML document can only leave `QName`
values invariant if one of the following provisions are made:

* The transformation leaves invariant the namespace context of every element. In that case it is sufficient to leave
  all literals invariant in order to leave all values invariant.

* Before applying the transformation, all `QName` literals are translated into `QName` values. When serializing the
  document after the transformation, `QName` values are translated back into `QName` literals. In that case, `QName`
  literals are no longer invariant under the transformation. As noted above, this approach requires knowledge of the
  schema describing the document instance being transformed.

The situation is further complicated by the fact that there are custom types that have properties similar to `QName`,
except that the semantics of these types are not defined at schema level, but by the application that eventually
consumes the document. A typical example are XPath expressions: they also use namespace prefixes and their
interpretation therefore also depends on the context in which they appear in the document.

Taking this into account, it is clear that the first approach described above is both simpler and more robust. The
drawback is that it will in many cases cause a proliferation of namespace declarations in the transformation result,
most of which are actually unnecessary. This can be seen for example on a transformation that simply extracts a single
element from a document: to preserve the namespace context, it would be necessary to copy the namespace declarations of
all ancestors of the element in the source document and add them to the element in the output document (except of course
for those namespace declarations that are hidden).

In a second post I will examine how the issue described here is handled by various XML specifications and Java
frameworks that describe or implement transformations on XML documents.

[1]: http://www.w3.org/tr/xmlschema-2