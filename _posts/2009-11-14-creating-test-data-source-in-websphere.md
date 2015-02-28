---
layout: post
title: "Creating a test data source in WebSphere 7"
category: tech
tags:
 - WebSphere
blogger: /2009/11/creating-test-data-source-in-websphere.html
disqus: true
---

If you need to quickly set up a test database and a corresponding JDBC data source in WebSphere 7,
you can use the preconfigured Derby JDBC provider for that purpose. Here is the procedure:

*   Choose a directory to store the database files. Make sure that the user ID running the server
    process has write access to the parent directory. Don't create the directory yet. It will be
    created automatically by Derby.

*   In the admin console, create a new data source with the following properties:

    *   JDBC Provider: Derby JDBC Provider (existing)
    
    *   Database name: the path of the directory chosen above
    
    *   Authentication aliases: none
    
*   Go to the "Custom properties" page for the data source and change the value of the
    `createDatabase` property to `create`.

*   Save the changes to the master configuration.

*   In the "Data sources" overview page, select the newly created data source and click
    "Test connection". This should create and start the database (you can verify this by looking
    at the configured file system directory).

When you no longer need the database, just remove the data source and delete the database directory.

Note that the following restrictions apply to data sources created using this procedure:

*   The database will be empty. Thus, the approach works best for applications able to create the
    database schema themselves (with JTA, use the `openjpa.jdbc.SynchronizeMappings` property in 
    `persistence.xml`).

*   The database can't be used in a cluster.

*   The data source doesn't support XA.
