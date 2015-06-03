---
layout: post
title: "Using Pax Exam in Maven builds"
category: tech
tags:
 - Maven
 - OSGi
 - Pax Exam
blogger: /2013/09/using-pax-exam-in-maven-builds.html
disqus: true
description: >
 Discover some of the pitfalls when using Pax Exam in a Maven build and learn how to avoid them.
updated: 2015-06-03
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

It is indeed possible to set up a project so that artifact downloading is handled exclusively by the Maven build, but
this requires the help of a custom Maven plugin to generate a set of [link files][5]. Some time ago I developed a plugin
that (among other things) is able to generate these files. This plugin is now available in Maven central and I'm using
it in several project, e.g. in [Apache Axiom][6]. Usage instructions can be found [here][7]. Feel free to experiment
with it and provide [feedback][8].

**Note:** A previous version of this article mentioned `org.apache.ws.commons.axiom:paxexam-maven-plugin`. That plugin
no longer exists. Please use the plugin described above.

[1]: http://wiki.ops4j.org/display/paxexam/Pax+Exam+-+Tutorial+1
[2]: http://docs.peergreen.com/peergreen_server/latest/reference/xhtml-single/peergreen-server-osgi-paxexam-junit-guide.xhtml
[3]: https://groups.google.com/forum/#!msg/ops4j/kRxAXidbt7A/w0i6tM1Mn9MJ
[4]: https://ops4j1.jira.com/browse/PAXEXAM-543
[5]: https://ops4j1.jira.com/wiki/display/paxurl/Link+Protocol
[6]: http://ws.apache.org/axiom/
[7]: http://veithen.github.io/alta/examples/pax-exam.html
[8]: https://github.com/veithen/alta/issues
