---
layout: post
title: "How to propagate SIGTERM to a child process in a Bash script"
category: tech
tags:
 - Bash
 - Docker
 - Supervisord
---

[Supervisord](http://supervisord.org/) requires that the programs it is configured to run
[don't daemonize](http://supervisord.org/subprocess.html) themselves. Instead, they should run in the
foreground and respond to the stop signal (TERM by default) by properly shutting down.
[Docker](https://www.docker.com/) has a similar requirement for the commands specified in
[CMD](http://docs.docker.com/reference/builder/#cmd) and [ENTRYPOINT](http://docs.docker.com/reference/builder/#entrypoint)
instructions in Dockerfiles. In both cases, only the processes created directly by Supervisord or
Docker receive the TERM signal and it is their responsibility to properly stop running child processes.

That is a problem if the actual server process is spawned by a shell script, as is often the case for a Java service:

    #!/bin/bash
    
    # Prepare the JVM command line
    ...
    
    $JAVA_EXECUTABLE $JAVA_ARGS
    
    # Clean up
    ...

In this case the TERM signal is received by the shell process, but Bash will not forward that
signal to the child process. This means that the shell process will stop, but the JVM will
continue to run.

If the command that creates the child process is the last one in the shell script, then the problem
can be easily solved using `exec`:

    #!/bin/bash
    ...
    exec $JAVA_EXECUTABLE $JAVA_ARGS

Instead of creating a new process, this will replace the shell process by the JVM. In this case the
TERM signal is received directly by the JVM and the problem is solved.

Things are more complicated if the shell script needs to perform some cleanup after the JVM
terminates. In this case we have no choice other than to create a child process, but we then need
to find a way to propagate the TERM signal to that child process and to wait for its completion
before executing the cleanup code. Here the [`trap` builtin](http://www.tldp.org/LDP/Bash-Beginners-Guide/html/sect_12_02.html)
comes to the rescue: it allows to configure a command to be executed when the shell receives
specific signals. However, there is an important restriction:

> When Bash receives a signal for which a trap has been set while waiting for a command to complete,
the trap will not be executed until the command completes.

This makes it necessary to execute the JVM as a background process (using `&`) and to wait for its
completion, so that the shell process can execute the trap while the child process is still running.
A solution often [presented on the Web][3] is to write the script as follows, using the `wait`
builtin to wait for the completion of the child process:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID' TERM
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    ...

However, this is not correct. To understand why, let's look at how `trap` and `wait` interact with
each other:

> When Bash is waiting for an asynchronous command via the `wait` built-in, the reception of a
signal for which a trap has been set will cause the `wait` built-in to return immediately with an
exit status greater than 128, immediately after which the trap is executed.

This means that the shell will start executing the instructions following the `wait` command
(and may even exit) before the child process has terminated. One solution is to wait for the
termination of the child process in the trap:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID; wait $PID' TERM
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    ...

This works because the trap is executed in the same thread as the normal control flow and therefore
suspends the execution of the script. However, the solution is still incomplete if the script needs
to retrieve the exit status of the child process. Normally, this information is
[returned](http://www.gnu.org/software/bash/manual/html_node/Job-Control-Builtins.html) by the
`wait` command:

> `wait [`*`jobspec`*` or `*`pid`*` ...]`
>
> Wait until the child process specified by each process ID *pid* or job specification *jobspec*
exits and return the exit status of the last command waited for. If a job spec is given, all
processes in the job are waited for. If no arguments are given, all currently active child
processes are waited for, and the return status is zero.

This works unless `wait` is interrupted by a signal, in which case it returns immediately with an
exit status greater than 128 (actually 128 plus the numeric value of the signal, which is 15 for SIGTERM).
One may want to use this information to distinguish between the two cases. However, this approach would be flawed
because the exit status of the child process may itself be greater than 128 (In particular the default signal
handler for SIGTERM causes the process to terminate with exit code 143).
One solution for this problem is to call `wait` twice:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID; wait $PID' TERM
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    wait $PID
    EXIT_STATUS=$?
    ...

This works because `wait` returns immediately (with the exit status of the process) if the process
has already exited. Waiting in the trap is then no longer necessary and the script can be simplified
as follows:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID' TERM
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    wait $PID
    EXIT_STATUS=$?
    ...

However, the solution is still not perfect because it doesn't handle SIGINT correctly. 
When CTRL+C is pressed, the terminal [sends a SIGINT to the foreground process group][1] of the
terminal (which in the case considered here comprises the shell process and its child process).
The problem is that Bash configures commands started in the background to [ignore SIGINT][2].
This means that CTRL+C only stops the script, but not the JVM.
To solve this issue and to mimic the behavior of the original script (which simply
executes `$JAVA_EXECUTABLE $JAVA_ARGS` in the foreground), it is sufficient to confiure the
same trap for the INT signal:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID' TERM INT
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    wait $PID
    EXIT_STATUS=$?
    ...

Finally, it may also be a good idea to remove the trap after the first signal has been received
or the JVM has stopped for some other reason:

    #!/bin/bash
    ...
    trap 'kill -TERM $PID' TERM INT
    $JAVA_EXECUTABLE $JAVA_ARGS &
    PID=$!
    wait $PID
    trap - TERM INT
    wait $PID
    EXIT_STATUS=$?
    ...

[1]: http://unix.stackexchange.com/questions/149741/why-is-sigint-not-propagated-to-childs-process-when-sent-to-its-parent-process#149756
[2]: http://unix.stackexchange.com/questions/55558/how-can-i-kill-and-wait-for-background-processes-to-finish-in-a-shell-script-whe#55591
[3]: http://unix.stackexchange.com/questions/146756/forward-sigterm-to-child-in-bash#146770