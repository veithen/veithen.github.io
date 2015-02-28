---
layout: post
title: "How to package Axis2 modules into WAR files built with Maven"
category: tech
tags:
 - Axis2
 - Maven
disqus: true
---

This article explains how to properly package Axis2 modules (MAR files) into Web applications
built using Maven. It is assumed that the Axis2 modules themselves are available as Maven artifacts,
either built in the same multi-module build or from another source.

The Axis2 modules to be included in the WAR must be declared as dependencies with artifact type `mar`:

~~~ markup
<dependency>
  <groupId>org.apache.rampart</groupId>
  <artifactId>rampart</artifactId>
  <version>1.6.2</version>
  <type>mar</type>
</dependency>
~~~

In order to make the Axis2 specific artifact type `mar` known to Maven, it is recommended to add
`axis2-mar-maven-plugin` to the project:

~~~ markup
<plugin>
  <groupId>org.apache.axis2</groupId>
  <artifactId>axis2-mar-maven-plugin</artifactId>
  <version>1.6.2</version>
  <extensions>true</extensions>
</plugin>
~~~

The reason for this being a recommendation and not a requirement is that the [default values
Maven uses for unknown artifact types][1] happen to be reasonably close to what is required
for MAR files.

Support for Axis2 modules was introduced in [`maven-war-plugin`][2] by [MWAR-193][3] and MAR files
are added automatically to the `WEB-INF/modules` directory inside the WAR file. There is however a
problem with that feature: it fails to generate a [`modules.list` file][4]. This means that the WAR will
only work if the servlet container deploys it in exploded form. If that restriction is acceptable to you
then you can stop reading here and simply use the built-in support for Axis2 modules in `maven-war-plugin`.

If you want the `modules.list` file to be created automatically during the build, you can use `axis2-repo-maven-plugin`
to generate the Axis2 repository[^1]. That plug-in was initially developed to make the Axis2 build itself more robust,
but you can use it in your own projects as well.

If you choose this approach, then the first step is to disable the MAR packaging feature in `maven-war-plugin`.
The only way to do this is to exclude the entire `WEB-INF/modules` tree from the WAR by adding 
the following option to the plug-in configuration:

~~~ markup
<packagingExcludes>
  <!-- Disable MWAR-193 -->
  WEB-INF/modules,
  WEB-INF/modules/*
</packagingExcludes>
~~~

This means that we need to choose a different path to store the modules inside the WAR. We will use
`WEB-INF/repository/modules`, i.e. we use `WEB-INF/repository` as the root of the Axis2 repository.
Using this new location requires changing the `axis2.repository.path` init parameter of the
`AxisServlet`, as shown below:

~~~ markup
<servlet>
  <servlet-name>AxisServlet</servlet-name>
  <servlet-class>org.apache.axis2.transport.http.AxisServlet</servlet-class>
  <init-param>
    <param-name>axis2.repository.path</param-name>
    <param-value>/WEB-INF/repository</param-value>
  </init-param>
</servlet>
~~~

We can now set up `axis2-repo-maven-plugin` to create the Axis2 repository during the build:

~~~ markup
<plugin>
  <groupId>org.apache.axis2</groupId>
  <artifactId>axis2-repo-maven-plugin</artifactId>
  <version>1.6.2</version>
  <executions>
    <execution>
      <phase>generate-resources</phase>
      <goals>
        <goal>create-repository</goal>
      </goals>
      <configuration>
        <outputDirectory>${project.build.directory}/webResources/WEB-INF/repository</outputDirectory>
        <generateFileLists>true</generateFileLists>
      </configuration>
    </execution>
  </executions>
</plugin>
~~~

The final step is to configure `maven-war-plugin` to include the repository in the WAR file:

~~~ markup
<webResources>
  <resource>
    <directory>${project.build.directory}/webResources</directory>
  </resource>
</webResources>
~~~

Putting everything together, the `maven-war-plugin` configuration should look as follows: 

~~~ markup
<plugin>
  <artifactId>maven-war-plugin</artifactId>
  <version>2.5</version>
  <configuration>
    <packagingExcludes>
      <!-- Disable MWAR-193 -->
      WEB-INF/modules,
      WEB-INF/modules/*
    </packagingExcludes>
    <webResources>
      <resource>
        <directory>${project.build.directory}/webResources</directory>
      </resource>
    </webResources>
  </configuration>
</plugin>
~~~

## Packaging AAR files

The approach described in this article can also be used to add AAR files to the WAR (although there are
other, potentially better ways to add Axis2 services to the Web application, such as including them in exploded form in the WAR).
This requires the following changes:

*   Declare the Axis2 services as dependencies with artifact type `aar`:

    ~~~ markup
    <dependency>
      <groupId>org.apache.axis2</groupId>
      <artifactId>version</artifactId>
      <version>1.6.2</version>
      <type>aar</type>
    </dependency>
    ~~~

*   Add `axis2-aar-maven-plugin` to the POM:

    ~~~ markup
    <plugin>
      <groupId>org.apache.axis2</groupId>
      <artifactId>axis2-aar-maven-plugin</artifactId>
      <version>1.6.2</version>
      <extensions>true</extensions>
    </plugin>
    ~~~

*   Add `WEB-INF/services` to `packagingExcludes`.


[^1]: In Axis2, the *repository* is the directory structure containing modules and services. `maven-war-plugin` assumes
      that the repository location is `WEB-INF`, so that (with a standard Axis2 configuration) modules are stored under
      `WEB-INF/modules` and services under `WEB-INF/services`.

[1]: /2015/01/10/maven-undefined-artifact-types.html
[2]: http://maven.apache.org/plugins/maven-war-plugin/
[3]: https://jira.codehaus.org/browse/MWAR-193
[4]: http://axis.apache.org/axis2/java/core/docs/app_server.html