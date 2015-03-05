---
layout: post
title: "Euphemism of the day: restoring backward compatibility"
category: tech
tags:
 - Axiom
blogger: /2009/11/euphemism-of-day-restoring-backward.html
disqus: true
description: >
 If you don't want to say "I fixed a bug that I introduced", just say "I restored backward compatibility".
---

Today somebody from IBM did the following [commit][1] on the Axiom project:

    -        } else if ("com.ibm.ws.prereq.banshee".equals(symbolicName)) {
    +        } else if ("IBM".equals(symbolicName)) {

I gently [pointed out][2] that the change looks strange and is probably a mistake (`symbolicName` and `vendor` are
attributes extracted from an OSGi bundle manifest):

> Shouldn't this be `"IBM".equals(vendor)` instead of `"IBM".equals(symbolicName)`???

Shortly afterwards, a new [commit][3]:

    -        } else if ("IBM".equals(symbolicName)) {
    +        } else if ("IBM".equals(vendor) || "com.ibm.ws.prereq.banshee".equals(symbolicName)) {

Guess what was the commit comment?

> Need to insure that the dialect detector remains backwards compatible

So, if you don't want to say "I fixed a bug that I introduced", just say "I restored backward compatibility"...

PS: That reminds me of the story where IBM tried to hide the fact that the first version of their StAX parser didn't
conform to the StAX specifications. Maybe I will blog about this story some day.

[1]: http://markmail.org/message/6iqzodxrn7c4rjph
[2]: http://markmail.org/message/uijmxcarytgsbnwg
[3]: http://markmail.org/message/mcipydgzwevv6jfi
