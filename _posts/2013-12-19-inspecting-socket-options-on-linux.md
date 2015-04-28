---
layout: post
title: "Inspecting socket options on Linux"
category: tech
tags:
 - Linux
 - TCP/IP
blogger: /2013/12/inspecting-socket-options-on-linux.html
disqus: true
description: >
 This article presents a tool to determine the socket options for TCP sockets created by processes on Linux.
---

The other day the question came up whether on Linux it is possible to determine the socket options for a TCP socket
created by some running process. The `lsof` command actually has an option for that (`-T f`), but it is not supported on
Linux. The reason is that socket options are not exposed via the `/proc` filesystem. This means that the only way to do
this is using [`strace`](http://linux.die.net/man/1/strace), [`ltrace`](http://linux.die.net/man/1/ltrace) or similar
tools. This is problematic because they require some special setup and/or produce large amounts of data that one needs
to analyze in order to get the desired information. Moreover, since they trace the invocation of the
[`setsockopt`](http://linux.die.net/man/2/setsockopt) syscall, they have to be used at socket creation time and are
useless if one needs to determine the options set on an already created socket.

In some cases, it is possible to determine the setting for particular socket options indirectly. E.g. the `netstat -to`
command allows to determine if `SO_KEEPALIVE` is enabled on the socket for an established TCP connection: the `-o`
option displays the currently active timer for each socket, and for established TCP connections with `SO_KEEPALIVE` set,
this will be the keepalive timer. Obviously this is not a general solution since it only works for a small subset of all
socket options.

To solve that issue, my original plan was to patch the Linux kernel to add the necessary information to the relevant
files in `/proc/net` (`tcp`, `tcp6`, `udp`, `udp6`, etc.). However, it turned out that this is not a trivial change
(such as adding a format specifier and argument to a `printf` call):

*   The files in `/proc/net` are not meant to be human readable; they define an interface between the kernel and user
    space tools. This means that before adding information about socket options, one first has to carefully define the
    format in which this information is presented.

*   The code that formats the entries in the various files in `/proc/net` is scattered over multiple files and partially
    duplicated (see e.g. `tcp4_seq_show` in `net/ipv4/tcp_ipv4.c` and `tcp6_seq_show` in `net/ipv6/tcp_ipv6.c`, as well
    as the functions called by these two functions).

That's why I finally settled on another idea, namely to write a kernel module that adds new files with the desired
information to `/proc/net`. These files would be human readable (with a format similar to the output of the `netstat`
command), so that one has more flexibility with respect to the presentation of the information in these files.

Fortunately the TCP/IP stack in Linux exports just enough of the relevant functions to enable reusing part of the code
that generates the `/proc/net/tcp` and `/proc/net/tcp6` files, making it fairly easy to implement such a kernel module.
The source code for the module is available as a project on Github called [knetstat](https://github.com/veithen/knetstat).
After building and loading the `knetstat` module, two new files appear in `/proc/net`:

    $ cat /proc/net/tcpstat
    Proto Recv-Q Send-Q Local Address           Foreign Address         State       Options
    tcp        0      0 127.0.0.1:6010          0.0.0.0:*               LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp        0      0 127.0.0.1:6011          0.0.0.0:*               LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp        0      0 127.0.0.1:6010          127.0.0.1:59038         ESTABLISHED SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp        0      0 127.0.0.1:59038         127.0.0.1:6010          ESTABLISHED SO_REUSEADDR=0,SO_KEEPALIVE=1
    tcp        0      0 192.168.1.15:22         192.168.1.6:57125       ESTABLISHED SO_REUSEADDR=1,SO_KEEPALIVE=1
    tcp        0      0 192.168.1.15:22         192.168.1.6:57965       ESTABLISHED SO_REUSEADDR=1,SO_KEEPALIVE=1
    $ cat /proc/net/tcp6stat
    Proto Recv-Q Send-Q Local Address           Foreign Address         State       Options
    tcp6       0      0 ::1:6010                :::*                    LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp6       0      0 ::1:6011                :::*                    LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0
    tcp6       0      0 :::22                   :::*                    LISTEN      SO_REUSEADDR=1,SO_KEEPALIVE=0

As implied by the name of the module, the format is indeed similar to the output of `netstat`, except of course for the
last column with the socket options:

    $ netstat -tan
    Active Internet connections (servers and established)
    Proto Recv-Q Send-Q Local Address           Foreign Address         State      
    tcp        0      0 127.0.0.1:6010          0.0.0.0:*               LISTEN     
    tcp        0      0 127.0.0.1:6011          0.0.0.0:*               LISTEN     
    tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN     
    tcp        0      0 127.0.0.1:6010          127.0.0.1:59038         ESTABLISHED
    tcp        0      0 127.0.0.1:59038         127.0.0.1:6010          ESTABLISHED
    tcp        0      0 192.168.1.15:22         192.168.1.6:57125       ESTABLISHED
    tcp        0      0 192.168.1.15:22         192.168.1.6:57965       ESTABLISHED
    tcp6       0      0 ::1:6010                :::*                    LISTEN     
    tcp6       0      0 ::1:6011                :::*                    LISTEN     
    tcp6       0      0 :::22                   :::*                    LISTEN     

Note that at the time of writing, knetstat only supports a small set of socket options and lacks support for socket
types other than TCP. Check the `README.md` file for the current list of supported features.
