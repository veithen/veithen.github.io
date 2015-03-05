---
layout: post
title: "Managing the SLF4J dependencies in complex Maven builds"
category: tech
tags:
 - Maven
 - SLF4J
blogger: /2009/10/taming-beast-managing-slf4j.html
disqus: true
description: >
 This article explains why the design of SLF4J causes challenges for dependency management in Maven and how to overcome
 these issues.
---

More and more projects now use [SLF4J][1] instead of the good old Commons Logging as a logging facade. This introduces
new challenges for complex Maven builds, because SLF4J will only work as expected if the dependencies are managed
correctly. To understand why this is so, let's first review the different components that are part of SLF4J:

* `slf4j-api` contains the SLF4J API, i.e. all the classes that an application or library using SLF4J directly depends
  on.

* A number of bindings that implement the SLF4J API either based on an existing logging framework (`slf4j-log4j12`),
  `slf4j-jdk14` and `slf4j-jcl`) or using a native implementation developed specifically for SLF4J (`slf4j-nop` and
  `slf4j-simple`).

* A number of bridges that adapt SLF4J to existing logging facades (`jul-to-slf4j`) or emulate existing logging facades
  or implementations (`jcl-over-slf4j` and `log4j-over-slf4j`).

For SLF4J to work correctly in a project built with Maven, the following conditions must be met:

1. The project must have a dependency on `slf4j-api`. If the project itself uses SLF4J and doesn't depend on any binding
   or bridge, then this should be a direct dependency. If SLF4J is used by one or more dependencies of the project, but
   not the project itself, then one may prefer to let Maven's dependency management system include it as a transitive
   dependency.

2. If the project produces an executable artifact (JAR with Main-Class, WAR, EAR or binary distribution), then it must
   have a dependency on one and only one of the bindings. Indeed, a binding is always required at runtime, but the
   presence of multiple bindings would result in unpredictable behavior.

3. The project may have any number of dependencies on SLF4J bridges, excluding the bridge for the API used by the
   binding. E.g. if `slf4j-log4j12` is used as a binding, then the project must not depend on `log4j-over-slf4j`.
   Otherwise the application may crash because of infinite recursions.

4. If the project has a dependency on a bridge that emulates an existing logging API, then it must not have at the same
   time a dependency on this API. E.g. if `jcl-over-slf4j` is used, then the project must not have a dependency on
   `commons-logging`. Otherwise the behavior will be unpredictable.

5. The dependencies must not mix artifacts from SLF4J 1.4.x with artifacts from 1.5.x, since they are incompatible with
   each other.

Note that rule number 2 really only applies to executable artifacts. A project that produces a library artifact should
never depend on any SLF4J binding, except in test scope. The reason is that depending on a given SLF4J binding in scope
compile or runtime would impose a particular logging implementation on downstream projects. In a perfect world where
every library (in particular third-party libraries) follows that practice, it would be very easy to validate the five
conditions enumerated above: it would simply be sufficient to add a dependency on the desired binding (as wells as any
necessary bridge) from SLF4J 1.5.x to every Maven project producing an executable artifact.

Alas, the world is not perfect and there are many third-party libraries that do have dependencies on particular SLF4J
bindings and logging implementations. If a projects starts depending on this type of libraries, things get easily out of
control if no countermeasures are taken. This is true especially for complex projects with lots of dependencies, which
will almost certainly run into a situation where one of the five conditions above is no longer satisfied.

Unfortunately, Maven doesn't have the necessary features that would allow to enforce these conditions a priori, and
enforcing them requires some discipline and manual intervention. On the other hand, there is a strategy that is quite
simple and effective when applied systematically:

* Make sure that in projects under your control, the policies described above are always followed.

* For third-party libraries that don't follow best practices, use exclusions on the corresponding dependency
  declarations to remove transitive dependencies on SLF4J bindings. Note that if the library is used in several modules
  of a multi-module Maven project, then it is handy to declare these exclusions in the dependency management section in
  the parent POM, so that it is not required to repeat it every time the dependency is used.

An example of this would look as follows:

~~~ markup
<dependencyManagement>
  <dependency>
    <groupid>com.acme</groupid>
    <artifactid>java-coffee-machine</artifactid>
    <version>7.5.194.3</version>
    <exclusions>
      <exclusion>
        <groupid>org.slf4j</groupid>
        <artifactid>slf4j-log4j12</artifactid>
      </exclusion>
    </exclusions>
  </dependency>
</dependencyManagement>
~~~

[1]: http://www.slf4j.org/
