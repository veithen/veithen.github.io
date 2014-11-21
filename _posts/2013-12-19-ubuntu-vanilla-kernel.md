---
layout: post
title: "Building and installing a vanilla Linux kernel on Ubuntu"
category: tech
tags:
 - Linux
---

This post describes a simple procedure to build and install a new Linux kernel on Ubuntu using the
official source code from the kernel developers' Git repository. The aim is to produce a kernel that
can be used as a drop-in replacement of the kernels shipped by Ubuntu and that neatly fits into the
distribution. The procedure was tested with Linux 3.12 on Ubuntu 13.10.

1.  Ensure that you have enough free disk space. Building the kernel using the present procedure may
    require up to 13 GB (!) of storage.

1.  Install the necessary build tools:

        sudo apt-get install kernel-package git

1.  Download the kernel sources:

        git clone git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git

1.  Check out the tag or branch for the kernel version you want to build. For example:

        cd linux
        git checkout v3.12

1.  Copy the configuration of the Ubuntu kernel. For the currently running kernel, use the following
    command:

        cp /boot/config-$(uname -r) .config

1.  Initialize new configuration options to their default values (See [here][1] for an explanation):

        yes "" | make oldconfig

1.  Use `make-kpkg` to compile the kernel and create Debian packages. You may want to use
    `--append-to-version` to add something to the version number, e.g. if you intend to apply
    patches to the kernel:

        fakeroot make-kpkg --initrd --append-to-version=-patched kernel-image kernel-headers

1.  Go back to the parent directory and install the generated packages using `dpkg -i`. This should
    take care of creating the initial ramdisk and configuring the boot loader. You can now reboot
    your system to load the new kernel.

[1]: http://serverfault.com/questions/116299/automatically-answer-defaults-when-doing-make-oldconfig-on-a-kernel-tree