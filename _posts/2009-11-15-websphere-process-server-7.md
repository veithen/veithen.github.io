---
layout: post
title: "Exciting new feature in WebSphere Process Server 7"
category: tech
tags:
 - WebSphere
blogger: /2009/11/exciting-new-feature-in-websphere.html
disqus: true
---

A couple of years ago, I've worked in a project where we used MQ Workflow, which is one of the ancestors of WebSphere
Process Server. Some of the business processes that we implemented were long running, and by long I mean really long,
that is up to several weeks. It happened to us that one of the processes that we deployed in production had a minor bug
that had not been discovered during testing. If I remember well, it was just a missing data connector between two
activities. Even if that was a minor bug, it completely corrupted the state of the process when that particular
transition was triggered.

Based on the number of running process instances with the incorrect template, and the probability that the particular
transition is triggered in the process, we were able to estimate the number of instances that would terminate
abnormally. Fortunately the number (both the estimated and the actual) turned out to be small (around 10), so that the
business impact was quite low. Nevertheless this was a very frustrating experience because you can only sit and wait
until another process instance becomes corrupted. It was not possible to proactively fix the running instances because
MQ Workflow didn't allow you to migrate running process instances to a new version of the process template (and
recreating these instances using some custom built ad hoc tool was far too risky).

Ever since that incident, whenever I meet somebody who happens to be (or pretends to be) a specialist in BPM, I always
ask the question of how to address this type of issue. I even asked that during a IBM training session on WebSphere
Process Server. I never got a satisfactory answer. It was only when I worked for Accenture that I discovered that some
smart guys in their labs had studied that issue and come up with a pattern to solve it. If I remember well, the pattern
somehow suggested to implement a single business process using three different BPEL processes that would then interact
together. Even if the overall process is long running, one of these BPELs would only be short running so that it could
be replaced by a new version at any time. Obviously this type of pattern far from optimal since it is expensive to
implement and tends to further increase the gap between the process designed by the business analyst and the BPEL
executing this process.

Recently IBM [announced][1] the release of WPS 7 and the announcement mentions the following new feature: "Deliver
migration of running processes to new process model versions". If this is really what I think it is (and if the IBM
people are able to deliver what they promise, which of course they have always been ;-), then this will be a major step
forward.

[1]: http://www-01.ibm.com/common/ssi/ShowDoc.jsp?docURL=/common/ssi/rep_ca/9/897/ENUS209-309/index.html&breadCrum=DET001PT022&url=buttonpressed=DET001PT116&page=1000&paneltext1=DET001PEF011&user+type=EXT&lang=en_GB&InfoType=AN&InfoSubType=CA&InfoDesc=Announcement+Letters&panelurl=index.wss?buttonpressed=DET001PT116&page=1000&paneltext1=DET001PEF011&user+type=EXT&paneltext=Announcement%20letter%20search

