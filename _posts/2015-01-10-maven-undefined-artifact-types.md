---
layout: post
title: "How Maven handles unknown artifact types"
category: tech
tags:
 - Maven
---

Artifact types are specified using the `type` element on dependencies:

~~~ markup
<dependency>
  <groupId>myproject</groupId>
  <artifactId>webapp</artifactId>
  <version>1.0</version>
  <type>war</type>
</dependency>
~~~

The list of artifact types defined by default can be found in the Maven documentation
under [Default Artifact Handlers Reference][1] or directly in the [source code][2].
Maven plug-ins can define additional artifact types. To use a custom artifact type in a given project,
the plug-in defining that artifact type must be added to the POM with `extensions` set to `true`:

~~~ markup
<plugin>
  <groupId>org.apache.axis2</groupId>
  <artifactId>axis2-mar-maven-plugin</artifactId>
  <version>1.6.2</version>
  <extensions>true</extensions>
</plugin>
~~~

The interesting question is how Maven handles undefined artifact types. The answer is dictated by
the following piece of code in [DefaultArtifactHandlerManager][3]:

~~~ java
handler = artifactHandlers.get( type );

if ( handler == null )
{
    handler = new DefaultArtifactHandler( type );
}
~~~

This means that Maven will not complaining about unknown artifact types. Instead it will generate
artifact handlers as required. A look at [DefaultArtifactHandler][4] allows us to determine what
will be the properties used by these handlers:

* `extension = type`
* `packaging = type`
* `classifier = null`
* `language = "none"`
* `addedToClasspath = false`
* `includesDependencies = false`

[1]: http://maven.apache.org/ref/3.2.5/maven-core/artifact-handlers.html
[2]: https://github.com/apache/maven/blob/maven-3.2.5/maven-core/src/main/resources/META-INF/plexus/artifact-handlers.xml
[3]: https://github.com/apache/maven/blob/maven-3.2.5/maven-core/src/main/java/org/apache/maven/artifact/handler/manager/DefaultArtifactHandlerManager.java
[4]: https://github.com/apache/maven/blob/maven-3.2.5/maven-core/src/main/java/org/apache/maven/artifact/handler/DefaultArtifactHandler.java
