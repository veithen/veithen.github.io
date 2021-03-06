---
layout: post
title: "Improve your Maven builds with Groovy"
category: tech
tags:
 - Maven
blogger: /2010/03/improve-your-maven-builds-with-groovy.html
disqus: true
description: >
 Since Maven is essentially metadata driven, it sometimes lacks the flexibility provided by script oriented build tools
 such as Ant. This article explains how to use Groovy to overcome this limitation.
---

Since Maven is essentially metadata driven, it sometimes lacks the flexibility provided by script oriented build tools such as Ant.
Of course, the [maven-antrun-plugin][1] can be used to execute Ant tasks during the Maven build lifecycle. However, Ant has its own
limitations. In those cases where neither Maven nor Ant provide a solution for a given problem, one may resort to Groovy as
scripting language. Indeed, Groovy is very powerful and easy to learn for people familiar with Java. Here are two concrete examples
where I used Groovy as part of a Maven build:

* Axiom: [Here][2] a Groovy script is used to generate a file list, something which (surprisingly) cannot be achieved with standard
  Ant tasks.

* Axis2: [Here][3] a test script uses Groovy to check a set of WSDL files produced by one of the Ant tasks that are part of the
  Axis2 tools. This script leverages Groovy's [GPath][4] expression language to navigate the nodes in an XML document and to build
  assertions on the content of the document.

[1]: http://maven.apache.org/plugins/maven-antrun-plugin/
[2]: http://svn.apache.org/viewvc/webservices/axiom/tags/1.2.14/modules/axiom-testutils/pom.xml?view=markup#l89
[3]: http://svn.apache.org/viewvc/axis/axis2/java/core/tags/v1.6.2/modules/tool/axis2-ant-plugin/pom.xml?view=markup#l156
[4]: http://www.groovy-lang.org/processing-xml.html#_gpath