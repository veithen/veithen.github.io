---
layout: post
title: "Publishing releases using Github, Bintray and maven-release-plugin"
category: tech
tags:
 - Maven
blogger: /2013/05/github-bintray-maven-release-plugin.html
disqus: true
description: Learn how to use Maven to publish releases of Github projects to Bintray.
---

## Project setup

1.  Add an SCM section to your POM so that maven-release-plugin can create a tag during the release process:

    ~~~ markup
    <scm>
      <connection>scm:git:https://github.com/{github-user}/{github-repo}.git</connection>
      <developerConnection>scm:git:git@github.com:{github-user}/{github-repo}.git</developerConnection>
      <url>https://github.com/{github-user}/{github-repo}</url>
      <tag>HEAD</tag>
    </scm>
    ~~~

    The developer connection uses the SSH protocol, so that no password authentication is required. Note that this
    assumes that you uploaded your public key to Github.

2.  Go to the Bintray Web site and create a new package in your repository.

3.  Add a distribution management section to your POM with a reference to that package:

    ~~~ markup
    <distributionManagement>
      <repository>
        <id>bintray</id>
        <url>https://api.bintray.com/maven/{bintray-user}/{bintray-repo}/{package}</url>
      </repository>
    </distributionManagement>
    ~~~

4.  Add your Bintray credentials to `settings.xml`. Note that Bintray REST API
    [uses API keys](https://bintray.com/docs/rest/api.html#_authentication) instead of passwords:

    ~~~ markup
    <server>
      <id>bintray</id>
      <username>{bintray-user}</username>
      <password>{bintray-api-key}</password>
    </server>
    ~~~

5.  Add the release plugin to your POM:

    ~~~ markup
    <build>
      <plugins>
        <plugin>
          <artifactId>maven-release-plugin</artifactId>
          <version>2.4.1</version>
          <configuration>
            <useReleaseProfile>false</useReleaseProfile>
            <releaseProfiles>release</releaseProfiles>
            <autoVersionSubmodules>true</autoVersionSubmodules>
          </configuration>
        </plugin>
      </plugins>
    </build>
    ~~~

    To deploy source and Javadoc JARs for releases, use the following release profile:

    ~~~ markup
    <profiles>
      <profile>
        <id>release</id>
        <build>
          <plugins>
            <plugin>
              <artifactId>maven-source-plugin</artifactId>
              <executions>
                <execution>
                  <id>attach-sources</id>
                  <goals>
                    <goal>jar</goal>
                  </goals>
                </execution>
              </executions>
            </plugin>
            <plugin>
              <artifactId>maven-javadoc-plugin</artifactId>
              <executions>
                <execution>
                  <id>attach-javadocs</id>
                  <goals>
                    <goal>jar</goal>
                  </goals>
                </execution>
              </executions>
            </plugin>
          </plugins>
        </build>
      </profile>
    </profiles>
    ~~~

    You should validate the release profile by executing it as follows:

        mvn -Prelease clean install

## Performing a release

1.  Go the the Bintray Web site and add a new version for the package.

2.  Execute the release process as follows:

        mvn release:prepare
        mvn release:perform

3.  Go to the Bintray Web site and publish the new version.

## Using the project as dependency

To use your project as a dependency in another project, add the following repository declaration:

~~~ markup
<repositories>
  <repository>
    <id>bintray</id>
    <url>http://dl.bintray.com/{bintray-user}/{bintray-repo}</url>
    <releases>
      <enabled>true</enabled>
    </releases>
    <snapshots>
      <enabled>false</enabled>
    </snapshots>
  </repository>
</repositories>
~~~
