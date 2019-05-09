What Storex is and is not
=========================

Every application needs to deal with data storage. We need to deal with databases, transport layers, serialization, access management, etc. These problems are not new, yet we keep reinventing them with every new language and framework out there, having to deal with pieces not exactly fitting together the right way with every new application we build. Storex wants to provide a structured way to talk about your data and what needs to happen with it, while leaving the heavy lifting to the Storex backends and your application logic. Through this, it enables you to postpone important decisions as possible, fit everything together as you need, and integrate it into existing applications easily without it wanting to dominate your application (it's a collection of libraries, not a framework.)

These are some of the principles behind Storex:

* Common problems around data should be easy, really specific ones should be possible by diving under the hood
* The core should provide way to talk about data problems, not actually solve them
* Backends should be able to provide functionality specific to them, and common operations and patterns should be able to flow into the core in a controlled way
* Packagages should do one thing, and do it well
* No unintented side-effects: no global variables or evil import-time code, so everything is easy to isolate and run in parallel if needed 

From this flows:

* Storex is not a framework
* Storex is not an ActiveRecord implementation (although you could build one on top, even though I believe they're are anti-patterns encoraging the mixing of business- with storage logic)

How it works
============

You initialize a StorageBackend imported from its respective package:

```
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'
const storageBackend = new DexieStorageBackend({dbName: 'my-awesome-product'})
```

You construct the storage manager, which will give you access to the StorageRegistry and the collection objects to access your data:

```
const storageManager = new StorageManager({ backend: storageBackend })

# More info about this below
storageManager.registry.registerCollections({
    user: { ... },
    todoList: { ... },
})

# This links together relationships you defined between different collections and tells the back-end to connect
await storageManager.finishInitialization()

# You can access meta-data about your collections and relationships between them here
storageManager.registry.collections.user.relationships

# You can manipulate and access your data here
const { object } = await storageManager.collection('user').createObject({ name: 'Fred', age: 36 })
const users = await storageManager.collection('user').findObjects({ name: 'Bob', age: { $gt: 30 }, ... })
```

Under the hood, the collection methods are convenience methods that call the central `storageManager.operation(...)` method:
```
await storageManager.operation('createObject', 'user', { name: 'bla' })
await storageManager.operation('executeBatch', [
    { operation: 'createObject', collection: 'user', args: { name: 'Diane' } },
    { operation: 'createObject', collection: 'user', args: { name: 'Jack' } },
])
```

All of the operations then are sent through the configured [middleware](./middleware.md), similar to Express middlewares, allowing for things like logging, normalization, etc. before actually actually executing `storageBackend.operation(...)`. The base class of the storage back-end then checks whether the operation you're trying to do is supported, after which it executes the operation.

Next steps
==========

To harness the full power of Storex, you'll probably want to:
* Organize your storage logic into [storage modules](https://github.com/WorldBrain/storex-pattern-modules)
* Understand [schema migrations](https://github.com/WorldBrain/storex-schema-migrations)
* Take a look at the [front-end boilerplate](https://github.com/WorldBrain/storex-frontend-boilerplate) to understand how you can set up an application that you can flexibly deploy in multiple configurations including in-memory, with GraphQL and an RDBMS, or Firestore.

In-depth documentation
======================

* [Defining collections](./collections.md): This is about the steps above where you interact with storageManager.registry, describing the various options for your collections, fields and relationships.
* [Interacting with data](./operations): How to query and manipulate your data.
* [Introspecting collections](./registry.md): How you can use the available meta-data about your data in your applications and when writing a back-end.
* [Using and writing middleware](./middleware.md): You can transform operations that your application does before they arrived at the `StorageBackend`.
* [Using and writing backend plugins](./plugins.md): Backend-specific operations are implemented using plugins. Read how to use and write them here.
* [Performing schema migrations](https://github.com/WorldBrain/storex-schema-migrations): Safely and DB-agnosticly migrate your data as your schema changes
* [Visualizing your data schema](https://github.com/WorldBrain/storex-visualize-graphviz): Still very primitive, but this generates a DOT file you can render with GraphViz of your data schema
