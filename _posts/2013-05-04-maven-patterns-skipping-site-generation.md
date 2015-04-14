---
layout: post
title: "Maven patterns: skipping site generation, but not staging"
category: tech
tags:
 - Maven
blogger: /2013/05/maven-patterns-skipping-site-generation.html
disqus: true
description: >
 In a multi-module Maven build, it is sometimes necessary to create a module that contributes content to the Maven site,
 but that doesn't have any content that needs to be rendered using maven-site-plugin. This article explains how to do
 this.
---

In a multi-module Maven build, it is sometimes necessary to create a module that contributes content to the Maven site,
but that doesn't have any content that needs to be rendered using `maven-site-plugin`. That is, the module doesn't
execute any reports and doesn't contain any XDoc or APT documents. Instead, it simply executes some plugin(s) in the
`site` phase to generate the content. Here are two scenarios where this is useful:

*   A module that contains documentation written in Docbook that should be published as HTML to the Maven site and also
    rendered as PDF for inclusion in a distribution. In this scenario, one would configure two executions of the
    [`docbkx-maven-plugin`](https://code.google.com/p/docbkx-tools/): one for the `generate-html` goal during the `site`
    phase, and one for the `generate-pdf` goal during the `compile` phase. One would then use
    `build-helper-maven-plugin` to attach the generated PDF file to the project so that it will be available later for
    inclusion in the distribution.

*   In a multi-module build, one generally wants to produce a single Javadoc collection for all the code in the project.
    This is typically done by configuring the `javadoc:aggregate` goal/report in the root POM. However, since that goal
    aggregates sources from all modules (excluding test sources), in large projects this often results in the inclusion
    of unwanted classes, e.g. utility classes that are used by the build process itself or by test code. An effective
    strategy to avoid this is to have a dedicated Maven module for the Javadoc generation and to use Maven dependencies
    (together with the `includeDependencySources` and `dependencySourceIncludes` parameters) to control which modules
    should be included in the Javadoc.

It is important to understand that although the site generation (i.e. the execution of the `site:site` goal) for these
modules should be skipped, the site staging must not be skipped. Otherwise, `mvn site:stage` would fail to assemble the
site.

With version 3.0 of the `maven-site-plugin`, it was enough to set the `skip` parameter to `true` to achieve this:

~~~ markup
<plugin>
  <artifactId>maven-site-plugin</artifactId>
  <configuration>
    <skip>true</skip>
  </configuration>
</plugin>
~~~

This would indeed skip the `site` goal, but not the `stage` goal.

It turns out that this is actually a bug. In fact, the documentation for the `skip` parameter reads:

> Set this to 'true' to skip site generation and staging.

In version 3.2, the `skip` parameter behaves as documented and the configuration shown above would not only skip site
generation, but also staging.

Instead of setting `skip` to `true`, one may try to set `generateReports` to `false`. This would indeed prevent
`maven-site-plugin` from generating any reports. Since in addition the module is not expected to have a `src/site`
folder, the `site` goal would generate no content. However, `maven-site-plugin` would still copy files from the site
skin (such as CSS files and images) to the output directory, and this is undesirable.

The correct solution is to override the default execution of the `site` goal and to apply the `skip` parameter only to
that execution:

~~~ markup
<plugin>
  <artifactId>maven-site-plugin</artifactId>
  <executions>
    <execution>
      <id>default-site</id>
      <phase>site</phase>
      <goals>
        <goal>site</goal>
      </goals>
      <configuration>
        <skip>true</skip>
      </configuration>
    </execution>
  </executions>
</plugin>
~~~
