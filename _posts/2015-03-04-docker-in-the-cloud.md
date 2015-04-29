---
layout: post
title: "Docker in the cloud"
category: tech
tags:
 - Docker
 - Google Cloud
twitter_text: "#Docker in the cloud"
twitter_tags: GoogleComputeEngine
image: /2015/03/04/my_other_computer.png
disqus: true
description: >
 Learn how to run a Docker daemon remotely in Google Compute Engine and control it from your Mac OS X workstation.
updated: 2015-04-29
---

## Introduction

This article explains how to run a [Docker][docker] daemon remotely in [Google Compute Engine][gce] and control it from
a Mac OS X client. This is an alternative to [boot2docker][boot2docker] (or to running Docker entirely in a local Linux
virtual machine) and is especially interesting if your workstation lacks the resources to start up your Docker
containers.

![My other computer is a data center](my_other_computer.png)

To achieve this, we need to install a Docker client on the Mac OS X workstation and the full Docker distribution in a
VM running on GCE. Since the protocol is incompatible between different Docker versions, it is important to use the same
version on both sides. In this article we will use Docker 1.5, which was the latest release at the time of writing. If
necessary, the instructions can easily be adapted for newer Docker versions.

## Installing the Docker client on Mac OS X

The [easiest way][docker-osx] to install the Docker client on Mac OS X is to use [Homebrew][brew]. If you don't have
this package manager yet, you can install it with the following command:

    ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

By default Homebrew always installs the latest available version of a package. However, as mentioned above, we need a
particular version of the Docker client. To install that particular version, we [specify the URL of the corresponding
Homebrew formula][brew-install-version] instead of just the package name:

    brew install https://raw.githubusercontent.com/Homebrew/homebrew/925e53b0ec49a03a31a2aaacc0cc49a8860b0454/Library/Formula/docker.rb

## Setting up Docker in Google Compute Engine

The instructions in this section assume that you already have a [GCE project][gce-project] and that you have installed
the [Google Cloud SDK][cloud-sdk]. We will also also assume that you have set that project as default project and that
you have configured a default zone where new VMs are created. If this is not the case, configure the `gcloud` command
line tool using `gcloud config`; for example:

    gcloud config set project myproject
    gcloud config set compute/zone europe-west1-b

You can then use the following command to create a new VM to run the Docker server:

    gcloud compute instances create docker --machine-type n1-standard-1 --image ubuntu-14-10

Of course, you may want to use a different machine type or a different Linux version. Note however that the installation
instructions in the remainder of this section apply to Debian based distributions and have only been tested on
Ubuntu 14.10.

Once the new VM has been created and started, use the following command to login:

    gcloud compute ssh docker

We are now ready to install Docker. As mentioned earlier, we need to install a Docker version that matches the version
of the client we set up in the previous section. Instead of using the Docker version that comes with the Ubuntu
distribution, use the following [sequence of commands][ubuntu-install-version] to install a package from the Ubuntu
repository at docker.com:

    sudo sh -c "echo deb http://get.docker.com/ubuntu docker main > /etc/apt/sources.list.d/docker.list"
    sudo apt-key adv --keyserver pgp.mit.edu --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9
    sudo apt-get update
    sudo apt-get install -y lxc-docker-1.5.0

By default, the Docker daemon listens on a Unix domain socket. To be able to connect remotely, we need to configure it
to listen to a TCP port instead. To do this, edit `/etc/default/docker` and add the following line:

    DOCKER_OPTS="-H tcp://localhost:2375"

This configures the Docker daemon to listen on the loopback device. This means that SSH access to the VM is required
to connect to Docker. This provides the desired level of security.

Note that if in addition to connecting remotely you want to continue to be able to use the docker client locally on the
VM, you should also configure the default UNIX domain socket:

    DOCKER_OPTS="-H tcp://localhost:2375 -H unix:///var/run/docker.sock"

Don't forget to restart the Docker daemon to apply the change:

    sudo /etc/init.d/docker restart

You can now disconnect from the VM.

## Connecting remotely to Docker

As described above, opening the Docker port in the firewall of the VM and connecting directly would not be secure.
Instead, use `gcloud` to create an SSH tunnel:

    gcloud compute ssh docker --ssh-flag="-L 2375:localhost:2375"

You can now execute Docker commands as follows:

    docker -H tcp://localhost:2375 ...

For example you can use the following command to test that the setup works as expected:

    docker -H tcp://localhost:2375 run -it --rm ubuntu:trusty bash

To avoid having to specify the `-H` option on every invocation of the `docker` command, define the `DOCKER_HOST`
environment variable as follows:

    export DOCKER_HOST="tcp://localhost:2375"

To set this variable persistently, add that instruction to the `~/.bash_profile` file.
You are now all set to build your Docker images and start containers remotely in the cloud!

## Caveats

*   When building images from Dockerfiles containing [`ADD`][add] or [`COPY`][copy] instructions, the Docker client
    needs to send the contents of the specified files or directories to the Docker daemon as part of the build context.
    Be aware that for large files this will take a significant amount of time and consume bandwidth.

[docker]: https://www.docker.com/
[gce]: https://cloud.google.com/compute/
[boot2docker]: http://boot2docker.io/
[docker-osx]: http://viget.com/extend/how-to-use-docker-on-os-x-the-missing-guide
[brew]: http://brew.sh/
[brew-install-version]: http://stackoverflow.com/questions/3987683/homebrew-install-specific-version-of-formula#answer-17757092
[cloud-sdk]: https://cloud.google.com/sdk/
[gce-project]: https://cloud.google.com/compute/docs/projects
[ubuntu-install-version]: https://github.com/docker/docker/issues/9697#issuecomment-67232206
[add]: https://docs.docker.com/reference/builder/#add
[copy]: https://docs.docker.com/reference/builder/#copy
