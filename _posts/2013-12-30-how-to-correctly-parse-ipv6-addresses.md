---
layout: post
title: "How to correctly parse IPv6 addresses (in C and Java)"
category: tech
tags:
 - C
 - Java
 - TCP/IP
 - Linux
blogger: /2013/12/how-to-correctly-parse-ipv6-addresses.html
disqus: true
description: >
 Learn how to correctly parse host parameters passed on the command line or read from a configuration file such that
 IPv6 addresses with zone IDs are recognized.
---

I recently started to do some [bug fixing][1] in [GNU Netcat][2]. One of the things I worked on was better support for
IPv6. In principle, IPv6 support was added to GNU Netcat [quite some time ago][3] on the trunk (aka 0.8-cvs), but it
turned out that it doesn't really work. After fixing two obvious bugs ([c8c0234][4], [714dcc5][5]), I stumbled over
another interesting issue.

One experiment I wanted to do with Netcat was to connect to another host over IPv6 using a link-local address. With
IPv6, a [link-local address][6] is [assigned automatically][7] to each interface that has a MAC address (i.e. all
Ethernet interfaces, but not the loopback interface). The IPv6 address is [derived][8] from the MAC address and is
unique (because MAC addresses are unique). E.g. an interface with the MAC address `08:00:27:84:0b:e2` would get the
following IPv6 address: `fe80::a00:27ff:fe84:be2`.

The problem with link-local addresses is that because of the way they are defined, the routing code in the operating
system has no clue which interface it has to use in order to send packets to such an address. Here is where zone IDs
come into play. The zone ID (also called scope ID) is a new feature in IPv6 that has no equivalent in IPv4. Basically,
in the case considered here, it identifies the interface through which packets have to be sent (but the concept is
[more general][9]).

Together with the concept of zone ID, the IPv6 specification also introduced a distinct [notation][10] to represent an
address with an associated zone ID:

    <address>%<zone_id>

In the case considered here, the zone ID is simply the interface name (at least, that is how it works on Linux and
Mac OS X). E.g. assuming that the remote host with MAC address `08:00:27:84:0b:e2` is attached to the same network as
the `eth0` interface on the local host, the complete address including the zone ID would be:

    fe80::a00:27ff:fe84:be2%eth0

This address can indeed be used with programs such as SSH to connect to the remote host. Unfortunately that didn't work
with GNU Netcat:

    $ netcat -6 fe80::a00:27ff:fe84:be2%eth0 22
    Error: Couldn't resolve host "fe80::a00:27ff:fe84:be2%eth0"

That raises the question how to correctly parse host parameters (passed on the command line or read from a configuration
file) such that IPv6 addresses with zone IDs are recognized. It turns out that Netcat was using the following strategy:

1.  Attempt to use [`inet_pton`][11] to parse the host parameter as an IPv4 or IPv6 address.

2.  If the host parameter is neither parsable as an IPv4 address nor an IPv6 address, assume that it is a host name and
    use [`gethostbyname`][12] to look up the corresponding address.

The problem with that strategy is that although `inet_pton` and `gethostbyname` both support IPv6 addresses, they don't
understand zone IDs. That is to be expected because both functions produce an `in6_addr` structure, but the zone ID is
part of the corresponding socket address structure [`sockaddr_in6`][13].

To fully support IPv6, several [enhancements][14] have been introduced in the Unix socket APIs. In our context the
[`getaddrinfo`][15] function is the most relevant one. It is able to parse IP addresses and to translate host names, but
in contrast to `inet_pton` and `gethostbyname` it produces `sockaddr_in6` (or `sockaddr_in`) structures and fully
supports zone IDs.

As a conclusion, to write C code that supports all types of IP address including IPv6 addresses with zone IDs, use the
following approach:

1.  Don't use `inet_pton` and `gethostbyname`; always use `getaddrinfo`.

2.  Don't assume that the information to connect to a remote host can be stored separately as a host address (`in_addr`
    or `in6_addr`) and a port number: that is only true for IPv4, but not for IPv6. Instead you should always use a
    socket address so that the zone ID can be stored as well. Obviously there are use cases where the host address and
    port number need to be processed at different places in the code (consider e.g. a port scanner that takes a host
    address/name and a port range). In those cases, you can still use `getaddrinfo`, but with a `NULL` value for the
    `service` argument. You then have to store the partially filled socket address and complete the port number later.

Unfortunately, fixing existing code to respect those guidelines may require [some extensive changes][16].

Interestingly, things are much easier and much more natural in Java. In fact, Java considers that the zone ID is part of
the host address (an [`Inet6Address`][17] instance in this case) so that the socket address ([`InetSocketAddress`][18])
simply comprises a host address and port number, exactly as in IPv4. This means that any code that uses the standard
[`InetAddress.getByName`][19] method to parse an IP address will automatically support IPv6 addresses with zone IDs.
Note that this is true even for code not specifically written with IPv6 support in mind (and even for code written
before the introduction of IPv6 support in Java 1.4), unless of course the code casts the returned `InetAddress` to an
`Inet4Address` or is not prepared to encounter a `:` in the host address, e.g. because it uses it as a separator between
the host address and the port number.

[1]: https://github.com/veithen/netcat
[2]: http://netcat.sourceforge.net/
[3]: http://sourceforge.net/p/netcat/code/357/
[4]: https://github.com/veithen/netcat/commit/c8c0234eec9299bada840305776b81fe7d1e41d9
[5]: https://github.com/veithen/netcat/commit/714dcc570d326fa82667984aac4b377f723f88d8
[6]: http://tools.ietf.org/html/rfc4291#section-2.5.6
[7]: http://tools.ietf.org/html/rfc4862#section-5.3
[8]: http://tools.ietf.org/html/rfc4291#section-2.5.1
[9]: http://tools.ietf.org/html/rfc4007
[10]: http://tools.ietf.org/html/rfc4007#section-11
[11]: http://linux.die.net/man/3/inet_pton
[12]: http://linux.die.net/man/3/gethostbyname
[13]: http://linux.die.net/man/7/ipv6
[14]: http://tools.ietf.org/html/rfc3493
[15]: http://linux.die.net/man/3/getaddrinfo
[16]: https://github.com/veithen/netcat/commit/f26fbe528100ae04c50d80575fb1e38f3dd3f24d
[17]: http://docs.oracle.com/javase/7/docs/api/java/net/Inet6Address.html
[18]: http://docs.oracle.com/javase/7/docs/api/java/net/InetSocketAddress.html
[19]: http://docs.oracle.com/javase/7/docs/api/java/net/InetAddress.html#getByName(java.lang.String)
