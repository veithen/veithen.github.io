---
layout: post
title: "How to build custom WebSphere plug-ins using Maven and Tycho"
category: tech
tags:
 - WebSphere
 - OSGi
 - Maven
blogger: /2012/11/how-to-build-custom-websphere-plug-ins.html
---

## Introduction

Beginning with WebSphere 6.1, the application server runtime is actually packaged as a set of OSGi
bundles running on Eclipse Equinox. This makes it possible to write your own custom plug-ins to
extend the server runtime. I used that possibility in my [XM4WAS](http://code.google.com/p/xm4was/)
project to enhance WebSphere's monitoring capabilities.

While the Eclipse IDE is the natural choice to develop this kind of plug-ins, you may still want to
automate the build process using Maven. The easiest way to set up the Maven build is using
[Tycho](http://eclipse.org/tycho/) because it allows Maven to use the metadata of the Eclipse project
(primarily the bundle manifest). This keeps the amount of configuration required in the POM files
small and ensures that the artifacts produced by Maven are identical to the ones produced by Eclipse.

However, there is an important difference between Maven/Tycho and Eclipse in the way dependencies are
resolved:

* To allow Eclipse to resolve dependencies to other WebSphere bundles, you will typically define a
  target platform that points to the WebSphere installation directory. Eclipse then automatically
  configures the project dependencies based on the bundle manifest.

* Although Tycho also [supports target platform definitions](http://wiki.eclipse.org/Tycho/Target_Platform),
  it has an important limitation: *The location types "Directory", "Installation", and "Features" are not
  supported.* That means that only software sites (i.e. P2 repositories) are supported.

Since there is no public P2 repository containing the WebSphere bundles, there is no simple way to use
a common configuration for Eclipse and Maven/Tycho. In the following I will discuss two possible solutions
for this problem.

## Importing the WebSphere bundles into the Maven repository

Starting with version 0.6.0, Tycho is able to use OSGi bundles deployed to Maven repositories. Therefore
one way to let Maven/Tycho resolve WebSphere dependencies is to deploy the bundles to the local (or a
private/company) Maven repository. Since WebSphere is built on top of an Eclipse runtime, this can be
easily achieved using the [to-maven](http://maven.apache.org/plugins/maven-eclipse-plugin/to-maven-mojo.html)
goal of the maven-eclipse-plugin. E.g. the following command will deploy the WebSphere bundles to the local
Maven repository:

~~~
mvn eclipse:to-maven -DeclipseDir=/opt/IBM/WebSphere/AppServer
~~~

Unfortunately this is not enough. To resolve dependencies, Tycho uses the information from the project's
manifest file. The manifest specifies dependencies using bundle symbolic names (Require-Bundle) or
package names (Import-Package). On the other hand, Maven needs the artifact coordinates (group ID,
artifact ID and version) to locate an artifact in the repository. The problem is that the eclipse:to-maven
goal doesn't produce the necessary metadata that would allow Tycho to locate a Maven artifact by exported
package.

To solve this problem, one has to declare the WebSphere bundles as Maven dependencies in the POM and
configure Tycho to consider these POM dependencies during calculation of the target platform (by setting
the pomDependencies property to "consider" in the configuration of the target-platform-configuration
plug-in).

While this approach looks rather simple at first, it has several important drawbacks:

* Tycho not only resolves the dependencies needed to build the project, but needs to calculate the entire
  target platform, i.e. the set of bundles required at runtime. This set includes transitive dependencies
  and is much larger. Since all of these bundles must be declared in the POM, one typically ends up
  declaring all WebSphere bundles in the POM and let Tycho choose the ones it really needs. The problem
  is that the WebSphere runtime has more than 100 bundles...

* The content of the WebSphere bundles may vary between fix packs. A package exported by some bundle in a
  given fix pack may be exported by a different bundle (typically a new one) in a later fix pack. If one
  uses Import-Package to specify dependencies, this is not a problem for the Eclipse project. However,
  for the Maven/Tycho build, all these bundles must also be declared as dependencies in the POM. This implies
  that the Maven build will only work with a certain range of fix packs and may break if the wrong
  fix pack is used.

* Before it can calculate the target platform, Tycho needs to scan the POM dependencies in order to
  extract the necessary metadata. Since the WebSphere runtime has more than 100 bundles, some of which
  are quite large, this has a significant impact on build time. In practice, the impact is so high that
  the dependency resolution takes more time than the actual build.

## Creating a P2 repository from the WebSphere bundles

Another option is to create a P2 repository from the WebSphere bundles and configure that repository
in Maven. Since P2 repositories contain OSGi specific metadata, Tycho will be able to calculate the
target platform without the need to declare additional POM dependencies. The Eclipse platform provides a
[tool](http://help.eclipse.org/galileo/topic/org.eclipse.platform.doc.isv/guide/p2_publisher.html) that
can be used to create the P2 repository (Note that the tool is not included in WebSphere; you need to
run the one that comes with the Eclipse IDE). The command looks as follows:

~~~
java -jar plugins/org.eclipse.equinox.launcher_*.jar -application org.eclipse.equinox.p2.publisher.FeaturesAndBundlesPublisher -metadataRepository file:/was_repo -artifactRepository file:/was_repo -source /opt/IBM/WebSphere/AppServer -compress -publishArtifacts
~~~

Once this is done, you can set up the repository in Maven:

~~~ markup
<repository>
    <id>p2</id>
    <layout>p2</layout>
    <url>file:/was_repo</url>
</repository>
~~~

If each developer is expected to set up his own (local) P2 repository (this would e.g. be the case in
an Open Source project), then the repository should be configured in `settings.xml` (because the
repository URL will not be the same for everyone). On the other hand, if you make the repository
accessible over HTTP (e.g. on a company-wide repository), then you can configure it in the POM.

Although the setup is more complicated, the P2 based approach eliminates all the drawbacks encountered
with the first approach. Nevertheless you need to take into account the following aspects:

* Most packages exported by the WebSphere bundles are not versioned. This means that dependency
  resolution is only predictable if the P2 repository contains artifacts from a single WebSphere
  version. This contrasts with the first approach where the WebSphere version is specified in the
  POM dependencies.

* If all your Maven modules have packaging "eclipse-plugin", then you don't need to declare any POM
  dependencies. However, you may still have some modules that have packaging "jar", such as modules
  that execute unit tests (outside of an OSGi container). For these modules, you again need POM
  dependencies. By convention, Maven artifacts loaded from a P2 repository have "p2.osgi.bundle" as
  group ID the bundle symbolic name as artifact ID.
