---
layout: post
title: "The real meaning of the ActiveTime PMI statistic in WebSphere"
category: tech
tags:
 - WebSphere
 - PMI
blogger: /2012/04/real-meaning-of-activetime-pmi.html
disqus: true
---

For thread pools, WebSphere has a PMI statistic called `ActiveTime`. According to the [documentation][1]
it is defined as *the average time in milliseconds the threads are in active state*. There is also a
statistic called `ActiveCount` that measures *the number of concurrently active threads*. E.g. on the
`WebContainer` thread pool this statistic enables one to determine the number of servlet requests being
processed simultaneously at a given point in time.

One would expect that correspondingly, `ActiveTime` measures the average time it takes to execute a task
on the thread pool and that on the `WebContainer` thread pool this would be the average time to process
a servlet request. However, this is not the case at all. Although the documentation of the two metrics
both refer to "active threads", they measure two completely different things. In fact, `ActiveTime`
measures the average time that threads **declared hanging**[^1] have been active. Obviously this definition renders the
`ActiveTime` statistic pretty much useless in most cases.

[^1]: For the readers not familiar with how WebSphere thread pools work, a thread is flagged as hanging after it has
      been active for longer than a configurable amount of time (10 minutes by default).

[1]: http://publib.boulder.ibm.com/infocenter/wasinfo/v7r0/topic/com.ibm.websphere.nd.doc/info/ae/ae/rprf_datacounter9.html