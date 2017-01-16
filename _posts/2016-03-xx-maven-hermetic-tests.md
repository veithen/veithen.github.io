---
layout: post
title: "Hermetic and secure test execution with Maven"
category: tech
tags:
 - Maven
disqus: false
---

Well designed tests should always be hermetic, i.e. they should not have dependencies on anything outside of the build
system. E.g. a test that fetches a document from a remote HTTP server would not be hermetic. Violating that principle
threatens build stability because there is no guarantee that the external dependency will exist forever and continue
to behave in the way expected by the test. Ideally tests should also be prevented from writing or deleting files in
random places in the file system (accidentally or because of bad design), i.e. they should basically be treated as
untrusted code. In the Java world, a natural choice to implement this is to execute tests with Java 2 security enabled
and appropriate policies in place. The present article explains how to set this up in a Maven build.

The tricky part is obviously the policy. Most permissions to be granted to unit tests are fairly static, but things get
more complicated when it comes to `FilePermission`. In a Maven build, write access should be granted only for two
locations on the file system: the `target` directory of the project in which the tests run and the temporary
directory. It is actually a good practice to configure the temporary directory as a subdirectory of the `target`
directory. This prevents tests from filling up the shared system-wide temporary directory and ensures that all files
remaining after test execution can be effectively removed using `mvn clean`. The Surefire configuration for this is very
simple (Note that for projects that have integration tests, the same configuration needs to be applied to
`maven-failsafe-plugin`):

            <plugin>
                <artifactId>maven-surefire-plugin</artifactId>
                <configuration>
                    <systemProperties>
                        <property>
                            <name>java.io.tmpdir</name>
                            <value>${project.build.directory}/tmp</value>
                        </property>
                    </systemProperties>
                </configuration>
            </plugin>

However, this may cause problems with tests that expect that the temporary directory already exists. To avoid this it
is necessary to create the directory before test execution starts. This can be done with the help of
`maven-antrun-plugin`, or using a Groovy script as shown in the following example:

            <plugin>
                <groupId>org.codehaus.gmavenplus</groupId>
                <artifactId>gmavenplus-plugin</artifactId>
                <executions>
                    <execution>
                        <id>create-tmp-directory</id>
                        <phase>initialize</phase>
                        <goals>
                            <goal>execute</goal>
                        </goals>
                        <configuration>
                            <scripts>
                                <script><![CDATA[
                                    import java.io.File
                                    
                                    // Create the temporary directory specified in the surefire configuration
                                    new File(project.build.directory, 'tmp').mkdirs()
                                ]]></script>
                            </scripts>
                        </configuration>
                    </execution>
                </executions>
            </plugin>

TODO: need to add Groovy dependency

Another option is to simply use the `target` directory as the temporary directory, but using a subdirectory makes it
possible to check that the code under test doesn't leave any temporary files behind. This can be explicitly asserted
by adding the following execution to the `gmavenplus-plugin`:

                    <execution>
                        <id>check-tmp-directory</id>
                        <phase>verify</phase>
                        <goals>
                            <goal>execute</goal>
                        </goals>
                        <configuration>
                            <scripts>
                                <script>
                                    import java.io.File
                                    
                                    if (new File(project.build.directory, 'tmp').listFiles().length > 0) {
                                        throw new Error("Temporary directory not empty");
                                    }
                                </script>
                            </scripts>
                        </configuration>
                    </execution>

After this digression about temporary files, let's continue with the discussion about `FilePermission` and determine
the read permissions that the tests will need. One option would be to grant read access to the entire file system, but
then the tests wouldn't be truly hermetic.

                    <execution>
                        <id>generate-policy-file</id>
                        <phase>generate-test-resources</phase>
                        <goals>
                            <goal>execute</goal>
                        </goals>
                        <configuration>
                            <scripts>
                                <script><![CDATA[
                                    import static groovy.json.StringEscapeUtils.escapeJava
                                    
                                    if (project.packaging != 'pom' && project.properties['hermeticTests'] == 'true') {
                                        new File(project.build.directory, "test.policy").withWriter { out ->
                                            out.println "grant {"
                                            out.println """  permission java.io.FilePermission "${escapeJava(System.properties.'java.home')}\${/}-", "read";"""
                                            out.println """  permission java.io.FilePermission "${escapeJava(session.settings.localRepository)}\${/}-", "read";"""
                                            session.sortedProjects.each({
                                                out.println """  permission java.io.FilePermission "${escapeJava(it.build.directory)}\${/}*", "read";"""
                                            })
                                            out.println """  permission java.io.FilePermission "${escapeJava(project.basedir.absolutePath)}", "read";"""
                                            out.println """  permission java.io.FilePermission "${escapeJava(project.basedir.absolutePath)}\${/}-", "read";"""
                                            out.println """  permission java.io.FilePermission "${escapeJava(project.build.directory)}", "read,write";"""
                                            out.println """  permission java.io.FilePermission "${escapeJava(project.build.directory)}\${/}-", "read,write,delete";"""
                                            out.println """  permission java.lang.RuntimePermission "*";"""
                                            out.println """  permission java.lang.reflect.ReflectPermission "*";"""
                                            out.println """  permission java.net.NetPermission "*";"""
                                            out.println """  permission java.net.SocketPermission "localhost", "connect,listen,accept,resolve";"""
                                            out.println """  permission java.security.SecurityPermission "*";"""
                                            out.println """  permission java.util.PropertyPermission "*", "read,write";"""
                                            out.println """  permission javax.management.MBeanPermission "*", "*";"""
                                            out.println """  permission javax.management.MBeanServerPermission "*";"""
                                            out.println """  permission javax.management.MBeanTrustPermission "*";"""
                                            out.println """  permission javax.xml.ws.WebServicePermission "publishEndpoint";"""
                                            out.println """  permission org.osgi.framework.AdminPermission "*", "*";"""
                                            out.println """  permission org.osgi.framework.ServicePermission "*", "register,get";"""
                                            out.println "};"
                                        }
                                        project.properties['securityManagerArgs'] = '-Djava.security.manager -Djava.security.policy=' + project.build.directory.replace('\\', '/') + '/test.policy'
                                    } else {
                                        project.properties['securityManagerArgs'] = ''
                                    }
                                ]]></script>
                            </scripts>
                        </configuration>
                    </execution>

    <properties>
        <hermeticTests>true</hermeticTests>
    </properties>


                    <argLine>${securityManagerArgs}</argLine>
