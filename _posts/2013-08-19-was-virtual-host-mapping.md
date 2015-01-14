---
layout: post
title: "Understanding virtual host mapping in WebSphere Application Server"
category: tech
tags:
 - WebSphere
blogger: /2013/08/was-virtual-host-mapping.html
---

Together with the context root, the virtual host assigned to a Web module determines under which URLs that Web module
will be accessible. In WebSphere, a virtual host is simply a set of host aliases, where each alias specifies a host name
(or a `*` wildcard to match any host name) and a port number. Configuring virtual hosts is pretty straightforward, but
problems may occur if there are multiple virtual host definitions that have overlapping host aliases, i.e. if the same
host name/port combination is matched by multiple virtual hosts.

To see why this happens, it is important to understand how virtual host mapping in WebSphere works internally. Each
application server maintains a map with the following structure:

{ host alias &rarr; { context root &rarr; Web module } }

That means that for each host alias, there is a separate map that maps from the context root to the Web module. Entries
in these data structures are created (resp. removed) as Web modules are started (resp. stopped). Note that at this point
wildcards are not replaced yet.

To illustrate how this works, consider the following sample topology:

* A WebSphere application cluster with two members running on hosts `srv-a.example.org` and `srv-b.example.org` and
  listening on port 9080.

* A Web server having two host names `web1.example.org` and `web2.example.org` and listening on port 80.

* Two Web modules `module1` (with context root `/app1`) and `module2` (with context root `/app2`) that are expected to
  answer requests on host names `web1.example.org` and `web2.example.org` respectively.

If one further assumes that `module1` and `module2` should also accept requests sent directly to `srv-a.example.org` and
`srv-b.example.org` (i.e. without going through the Web server), then one would define the following virtual hosts:

* `vhost1` with aliases `web1.example.org:80` and `*:9080`.

* `vhost2` with aliases `web2.example.org:80` and `*:9080`.

`module1` would be mapped to `vhost1` and `module2` would be mapped to `vhost2`. Both cluster members would then build the following map internally:

<table class="table">
<thead>
<tr><th>Alias</th><th>Context root</th><th>Web module</th></tr>
</thead>
<tbody>
<tr><td><code>web1.example.org:80</code></td><td><code>/app1</code></td><td><code>module1</code></td></tr>
<tr><td><code>web2.example.org:80</code></td><td><code>/app2</code></td><td><code>module2</code></td></tr>
<tr><td rowspan="2"><code>*:9080</code></td><td><code>/app1</code></td><td><code>module1</code></td></tr>
<tr><td><code>/app2</code></td><td><code>module2</code></td></tr>
</tbody>
</table>

The structure of the map described above implies that mapping a request to a Web module is a two-step process. WebSphere
will first match the `Host` header of the incoming request. At this point, wildcards are processed. WebSphere will then
use the corresponding { context root &rarr; Web module } map to look up the Web module based on the path part of the
URL.

In the example shown above, the fact that the same host alias appears in multiple virtual host definition doesn't cause
any issue. Any request sent directly to the application servers via port 9080 will be routed correctly to the expected
Web module.

Now consider a slightly different virtual host configuration:

* `vhost1` with aliases `web1.example.org:80` and `*:9080`.

* `vhost2` with aliases `web2.example.org:80`, `srv-a.example.org:9080` and `srv-b.example.org:9080`.

This will result in the following map:

<table class="table">
<thead>
<tr><th>Alias</th><th>Context root</th><th>Web module</th></tr>
</thead>
<tbody>
<tr><td><code>web1.example.org:80</code></td><td><code>/app1</code></td><td><code>module1</code></td></tr>
<tr><td><code>web2.example.org:80</code></td><td><code>/app2</code></td><td><code>module2</code></td></tr>
<tr><td><code>*:9080</code></td><td><code>/app1</code></td><td><code>module1</code></td></tr>
<tr><td><code>srv-a.example.org:9080</code></td><td><code>/app2</code></td><td><code>module2</code></td></tr>
<tr><td><code>srv-b.example.org:9080</code></td><td><code>/app2</code></td><td><code>module2</code></td></tr>
</tbody>
</table>

In this case, things will not work as expected. In fact, requests for `http://srv-a.example.org:9080/app1/index.html`
will not be routed to `module1`. As noted earlier, WebSphere will first match the `Host` header against the host
aliases. The value of that header (`srv-a.example.org:9080`) matches both `*:9080` and `srv-a.example.org:9080`, but
WebSphere will select the second one because it is more specific than the alias with the wildcard. WebSphere will then
look at the { context root &rarr; Web module } map for that alias. The problem is that this map now contains a single
entry mapping `/app2` to `module2`, i.e. there is no entry matching `/app1/index.html`.

The conclusion is that when configuring virtual hosts, a problem will occur if one virtual host has an alias of the form
host:port and another one has an alias *:port with the same port number.
