---
layout: post
title: "Using Pax Exam in Maven builds"
category: tech
tags:
 - Maven
 - OSGi
blogger: /2013/09/using-pax-exam-in-maven-builds.html
disqus: true
description: >
 Discover some of the pitfalls when using Pax Exam in a Maven build and learn how to avoid them.
updated: 2014-02-23
---

The [recommended approach][1] (see also [here][2]) to run OSGi unit tests with Pax Exam in a Maven build relies on the
`pax-url-aether` library. This library allows to resolve Maven artifacts and to provision them as bundles to the OSGi
runtime started by Pax Exam. Assuming that the bundles to be provisioned are declared as Maven dependencies in the
project, a typical Pax Exam configuration would look as follows (Note that `asInProject()` relies on the execution of
the `org.apache.servicemix.tooling:depends-maven-plugin` during the build):

~~~ java
@Configuration
public static Option[] configuration() {
    return options(
        mavenBundle().groupId("org.example").artifactId("mybundle").version(asInProject()),
        junitBundles());
}
~~~

While at first glance this looks straightforward and natural, there are a couple of issues with this approach. The
problem is that `pax-url-aether` creates its own Maven session to resolve artifacts, thereby bypassing the underlying
Maven build. This means that the resolution performed by Pax Exam doesn't necessarily use the same configuration as the
Maven build. There are several known circumstances where this causes problems:

1.  Repositories configured in the POM. Some have [argued][3] that declaring repositories in POMs is discouraged. That
    argument is correct for repositories containing release artifacts, but not for snapshot repositories: all release
    dependencies should indeed be available from the central repository, but dependencies on snapshot versions from
    upstream projects necessarily require configuration of additional repositories. The right place to configure these
    repositories is in the POM, not in `settings.xml`.

2.  The location of the local Maven repository (normally specified in `settings.xml`) can be overridden using the
    `maven.repo.local` system property. However, Pax Exam only looks at `settings.xml`. While overriding the local Maven
    repository on the command line is rarely done when running Maven manually, it is quite common for builds executed by
    a CI tool. E.g. Jenkins has a "Use private Maven repository" option that does exactly that (with a local repository
    in the Jenkins workspace). This problem is described in [PAXEXAM-543][4].

3.  Offline mode. This mode is enabled using the `-o` switch on the `mvn` command, but Pax Exam has no way to detect
    this and will continue trying to access remote Maven repositories.

Probably this list is not exhaustive and there are other POM settings that will cause similar problems.

Actually the whole approach of having Pax Exam resolve Maven dependencies on its own is questionable. This is certainly
a very useful feature when used outside of a Maven build (e.g. to provision bundles directly from a Maven repository to
a stand-alone OSGi container), but in a Maven build, it should be Maven's responsibility to download artifacts, and Pax
Exam's role should be limited to provisioning them to the embedded OSGi container.

The question is then how to achieve this. There seems to be no out-of-the-box way to do this with Pax Exam, and
therefore I decided to develop my own tools to implement this approach in one of the projects ([Apache Axiom][5]) where
I encountered the issues described earlier. The approach is actually quite simple. I have a [custom Maven plugin][6]
that does the following:

*   It scans the dependencies (including transitive dependencies) of the Maven project for artifacts of type `jar` that
    are OSGi bundles.

*   For each OSGi bundle found, it generates a [link file][7] with a `file` URL pointing to the downloaded artifact in
    the local Maven repository. The name of the link file is derived from the symbolic name of the bundle (with a suffix
    of `.link`).

*   It adds the directory containing the link files to the test resource locations of the project, so that the link
    files will be available from the class path when the tests are executed.

The plugin doesn't require any additional configuration. In the Maven project, it is simply set up as follows:

~~~ markup
<plugin>
  <groupId>org.apache.ws.commons.axiom</groupId>
  <artifactId>paxexam-maven-plugin</artifactId>
  <version>1.2.15-SNAPSHOT</version>
  <executions>
    <execution>
      <goals>
        <goal>generate-link-files</goal>
      </goals>
    </execution>
  </executions>
</plugin>
~~~

In the Pax Exam configuration, these bundles can then easily be provisioned to the OSGi runtime using `link:classpath:`
URLs as shown in the following example:

~~~ java
@Configuration
public static Option[] configuration() {
    return options(
        url("link:classpath:org.example.mybundle.link"),
        junitBundles());
}
~~~

Note that the plugin is currently only available from the [Apache snapshot repository][8]. Feel free to experiment with
it and provide feedback.

There is one remaining question that needs to be addressed. While the approach described here works very well when the
tests are executed by the Maven build, what about IDE integration? Is it possible to execute the tests easily in Eclipse
(sorry for NetBeans and IntelliJ users, but Eclipse is my favored IDE)? It turns out that this is indeed possible. As
mentioned earlier, the plugin is designed to add the directory containing the links as a test resource location to the
Maven project. That location will be picked up (and added to the Eclipse project) automatically by the
maven-eclipse-plugin, provided that the `generate-test-resources` phase is executed. Therefore, the Maven project can be
successfully imported into Eclipse using the following command line:

    mvn clean install -DskipTests=true eclipse:eclipse

----------------------------------------

*Update, Febrary 23, 2014*

Even with the project setup described above, `pax-exam-link-mvn` is still a required dependency. If that dependency is
removed, then the build will fail with the following obscure error message:

    java.lang.IllegalStateException: Stream handler unavailable due to: null

The reason for the obscure and not very helpful error message is some sloppy error handling in
`org.apache.felix.framework.URLHandlersStreamHandlerProxy#openConnection(URL)`. The code in that method uses reflection,
but doesn't process `InvocationTargetException` correctly: instead of attempting to unwrap the exception and rethrow the
original exception, it will actually always wrap the `InvocationTargetException` in an `IllegalStateException` without
properly chaining the exceptions, resulting in the error message shown above.

Debugging reveals that the actual exception is:

    java.io.IOException: URL [META-INF/links/org.ops4j.pax.exam.link] could not be resolved from classpath

That resource is part of `pax-exam-link-mvn` and has the following content:

    mvn:org.ops4j.pax.exam/pax-exam/3.3.0

What this means is that Pax Exam will still use its own Maven session to resolve certain artifacts, namely the core
bundles that are deployed by default into the OSGi runtime.

[1]: http://wiki.ops4j.org/display/paxexam/Pax+Exam+-+Tutorial+1
[2]: http://docs.peergreen.com/peergreen_server/latest/reference/xhtml-single/peergreen-server-osgi-paxexam-junit-guide.xhtml
[3]: https://groups.google.com/forum/#!msg/ops4j/kRxAXidbt7A/w0i6tM1Mn9MJ
[4]: https://ops4j1.jira.com/browse/PAXEXAM-543
[5]: http://ws.apache.org/axiom/
[6]: https://svn.apache.org/repos/asf/webservices/axiom/trunk/buildutils/paxexam-maven-plugin/
[7]: https://ops4j1.jira.com/wiki/display/paxurl/Link+Protocol
[8]: https://repository.apache.org/content/repositories/snapshots/
