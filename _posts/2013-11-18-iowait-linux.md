---
layout: post
title: "The precise meaning of I/O wait time in Linux"
category: tech
tags:
 - Linux
blogger: /2013/11/iowait-linux.html
disqus: true
updated: 2015-03-03
---

Some time ago I had a discussion with some systems guys about the exact meaning of the I/O wait time
which is displayed by `top` as a percentage of total CPU time. Their answer was that it is the time
spent by the CPU(s) while waiting for outstanding I/O operations to complete. Indeed, the man page
for the `top` command defines this as the "time waiting for I/O completion".

However, this definition is obviously not correct (or at least not complete), because a CPU never
spends clock cycles waiting for an I/O operation to complete. Instead, if a task running on a given
CPU blocks on a synchronous I/O operation, the kernel will suspend that task and allow other tasks
to be scheduled on that CPU.

So what is the exact definition then? There is an interesting [Server Fault question][1] that
discussed this. Somebody came up with the following definition that describes I/O wait time as a
sub-category of idle time:

>iowait is time that the processor/processors are waiting (i.e. is in an idle state and does
nothing), during which there in fact was outstanding disk I/O requests.

That makes perfect sense for uniprocessor systems, but there is still a problem with that definition
when applied to multiprocessor systems. In fact, "idle" is a state of a CPU, while "waiting for I/O
completion" is a state of a task. However, as pointed out earlier, a task waiting for outstanding
I/O operations is not running on any CPU. So how can the I/O wait time be accounted for on a per-CPU
basis?

For example, let's assume that on an otherwise idle system with 4 CPUs, a single, completely I/O
bound task is running. Will the overall I/O wait time be 100% or 25%? I.e. will the I/O wait time be
100% on a single CPU (and 0% on the others), or on all 4 CPUs? This can be easily checked by doing a
simple experiment. One can simulate an I/O bound process using the following command, which will
simply read data from the hard disk as fast as it can:

    dd if=/dev/sda of=/dev/null bs=1MB

Note that you need to execute this as `root` and if necessary change the input file to the
appropriate block device for your hard disk.

Looking at the CPU stats in `top` (press `1` to get per-CPU statistics), you should see something like
this:

    %Cpu0  :  3,1 us, 10,7 sy,  0,0 ni,  3,5 id, 82,4 wa,  0,0 hi,  0,3 si,  0,0 st
    %Cpu1  :  3,6 us,  2,0 sy,  0,0 ni, 90,7 id,  3,3 wa,  0,0 hi,  0,3 si,  0,0 st
    %Cpu2  :  1,0 us,  0,3 sy,  0,0 ni, 96,3 id,  2,3 wa,  0,0 hi,  0,0 si,  0,0 st
    %Cpu3  :  3,0 us,  0,3 sy,  0,0 ni, 96,3 id,  0,3 wa,  0,0 hi,  0,0 si,  0,0 st

This output indicates that a single I/O bound task only increases the I/O wait time on a single
CPU. Note that you may see that occasionally the task "switches" from one CPU to another. That is
because the Linux kernel tries to schedule a task on the CPU it ran last (in order to improve CPU
cache hit rates), but this is not always possible and the task is moved on another CPU. On some
systems, this may occur so frequently that the I/O wait time appears to be distributed over multiple CPUs,
as in the following example:

    %Cpu0  :  5.7 us,  5.7 sy,  0.0 ni, 50.5 id, 34.8 wa,  3.3 hi,  0.0 si,  0.0 st
    %Cpu1  :  3.0 us,  3.3 sy,  0.0 ni, 72.5 id, 20.9 wa,  0.3 hi,  0.0 si,  0.0 st
    %Cpu2  :  7.0 us,  4.3 sy,  0.0 ni, 62.0 id, 26.7 wa,  0.0 hi,  0.0 si,  0.0 st
    %Cpu3  :  4.3 us,  2.3 sy,  0.0 ni, 89.6 id,  3.7 wa,  0.0 hi,  0.0 si,  0.0 st

Nevertheless, assuming that `dd` is the only task doing I/O on the system, there can be at most one
CPU in state I/O wait at any given point in time. Indeed, 34.8+20.9+26.7+3.7=86.1 which is close to but
lower than 100.

To make the experiment more reproducible, we can use the `taskset` command to "pin" a process
to a given CPU (Note that the first command line argument is not the CPU number, but a mask):

    taskset 1 dd if=/dev/sda of=/dev/null bs=1MB

Another interesting experiment is to run a CPU bound task at the same time on the same CPU:

    taskset 1 sh -c "while true; do true; done"

The I/O wait time now drops to 0 on that CPU (and also remains 0 on the other CPUs), while user and
system time account for 100% CPU usage:

    %Cpu0  : 80,3 us, 15,5 sy,  0,0 ni,  0,0 id,  0,0 wa,  0,0 hi,  4,3 si,  0,0 st
    %Cpu1  :  4,7 us,  3,4 sy,  0,0 ni, 91,3 id,  0,0 wa,  0,0 hi,  0,7 si,  0,0 st
    %Cpu2  :  2,3 us,  0,3 sy,  0,0 ni, 97,3 id,  0,0 wa,  0,0 hi,  0,0 si,  0,0 st
    %Cpu3  :  2,7 us,  4,3 sy,  0,0 ni, 93,0 id,  0,0 wa,  0,0 hi,  0,0 si,  0,0 st

That is expected because I/O wait time is a sub-category of idle time, and the CPU to which we
pinned both tasks is never idle.

These findings allow us to deduce the exact definition of I/O wait time:

<i>
*For a given CPU, the I/O wait time is the time during which that CPU was idle (i.e. didn't execute
any tasks) and there was at least one outstanding disk I/O operation requested by a task scheduled
on that CPU (at the time it generated that I/O request).*

Note that the nuance is not innocent and has practical consequences. For example, on a system with
many CPUs, even if there is a problem with I/O performance, the observed overall I/O wait time may
still be small if the problem only affects a single task. It also means that while it is generally
correct to say that faster CPUs tend to increase I/O wait time (simply because a faster CPU tends to
be idle more often), that statement is no longer true if one replaces "faster" by "more".

[1]: http://serverfault.com/questions/12679/can-anyone-explain-precisely-what-iowait-is