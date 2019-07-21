---
layout: post
title: "Building and installing a vanilla Linux kernel on Ubuntu"
category: tech
tags:
 - Linux
blogger: /2013/12/ubuntu-vanilla-kernel.html
updated: 2019-07-21
disqus: true
description: >
 This post describes a simple procedure to build and install a new Linux kernel on Ubuntu using the
 official source code from the kernel developers' Git repository. The aim is to produce a kernel that
 can be used as a drop-in replacement of the kernels shipped by Ubuntu and that neatly fits into the
 distribution.
---

This post describes a simple procedure to build and install a new Linux kernel on Ubuntu using the
official source code from the kernel developers' Git repository. The aim is to produce a kernel that
can be used as a drop-in replacement of the kernels shipped by Ubuntu and that neatly fits into the
distribution.

The procedure has been tested with Linux 3.12 on Ubuntu 13.10 and Linux 3.18 on Ubuntu 14.04.
It also works with older kernels; e.g. it is possible to install a 2.6.39 kernel on Ubuntu 14.04, which
is quite handy when developing kernel modules that need to be compatible with a wide range of kernel
versions.

1.  Ensure that you have enough free disk space. Building the kernel using the present procedure may
    require up to 13 GB (!) of storage.

1.  Install the necessary build tools:

    ~~~ bash
    sudo apt-get install kernel-package git libssl-dev bison flex
    ~~~

1.  Download the kernel sources:

    ~~~ bash
    git clone git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git
    ~~~

1.  Check out the tag or branch for the kernel version you want to build. For example:

    ~~~ bash
    cd linux
    git checkout v3.12
    ~~~

1.  Copy the configuration of the Ubuntu kernel. For the currently running kernel, use the following
    command:

    ~~~ bash
    cp /boot/config-$(uname -r) .config
    ~~~

1.  Initialize new configuration options to their default values (See [here][1] for an explanation):

    ~~~ bash
    yes "" | make oldconfig
    ~~~

1.  Use `make-kpkg` to compile the kernel and create Debian packages. You may want to use
    `--append-to-version` to add something to the version number, e.g. if you intend to apply
    patches to the kernel:

    ~~~ bash
    fakeroot make-kpkg --initrd --append-to-version=-patched kernel-image kernel-headers -j $(getconf _NPROCESSORS_ONLN)
    ~~~

1.  Go back to the parent directory and install the generated packages using `dpkg -i`. This should
    take care of creating the initial ramdisk and configuring the boot loader. You can now reboot
    your system to load the new kernel.

## Known issues

*   `make-kpkg` may fail with the following error:

    ~~~
    /etc/kernel/postinst.d/apt-auto-removal: 84: /etc/kernel/postinst.d/apt-auto-removal: cannot create /etc/apt/apt.conf.d//01autoremove-kernels.dpkg-new: Permission denied
    run-parts: /etc/kernel/postinst.d/apt-auto-removal exited with return code 2
    ~~~
    {: class="wrap"}

    This issue is documented in Ubuntu bug [1308183][2]. To work around the problem, install version 13.003
    of `kernel-package` as described in that bug report.


[1]: http://serverfault.com/questions/116299/automatically-answer-defaults-when-doing-make-oldconfig-on-a-kernel-tree
[2]: https://bugs.launchpad.net/ubuntu/+source/kernel-package/+bug/1308183
