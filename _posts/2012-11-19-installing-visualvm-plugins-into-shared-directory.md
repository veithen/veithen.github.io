---
layout: post
title: "Installing VisualVM plug-ins into the shared directory"
category: tech
tags:
 - VisualVM
blogger: /2012/11/installing-visualvm-plug-ins-into.html
disqus: true
description: >
 This article describes how to install VisualVM plug-ins into the shared installation directory instead of the user's
 home directory. This is useful if the VisualVM installation is used by multiple users on the same system or if you want
 to create a custom VisualVM distribution with a set of preinstalled plug-ins.
---

This article describes how to install VisualVM plug-ins into the shared installation directory instead of the user's
home directory. This is useful if the VisualVM installation is used by multiple users on the same system or if you want
to create a custom VisualVM distribution with a set of preinstalled plug-ins. Actually the "Force install into shared
directories" option in the plug-in installation dialog (see the "Settings" tab) should enable that, but the option
doesn't seem to work in VisualVM 1.3.4.

The following procedure can be used as a workaround:

*   Start with a clean VisualVM configuration, i.e. remove (or backup) the `${HOME}/.visualvm/x.y.z` folder (Note that
    on Windows, `${HOME}` points to the user's `Application Data` directory).

*   Launch VisualVM and install the relevant plug-ins. They will be placed into `${HOME}/.visualvm/x.y.z/modules`.

*   Create a new directory called `custom` (you may of course choose a different name if you want) under the VisualVM
    installation directory (i.e. at the same level as the `platform` and `visualvm` directories).

*   Copy the following folder structures from `${HOME}/.visualvm/x.y.z` to the `custom` directory (so that the resulting
    folder structure matches the one in `platform` and `visualvm`):

    *   `config/Modules`

    *   `modules`

    *   `update_tracking`
    
*   Edit the `etc/visualvm.clusters` file and add the `custom` folder to the list.

*   Clear the user configuration, i.e. reexecute the first step.

If you start VisualVM now, the plug-ins you have copied to the `custom` folder should be available immediately.
