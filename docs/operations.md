Once you've registered your collection models and have initialized the StorageManager, you can begin playing with your data. For now, there are only basic CRUD operation, but we'll extend the functionality offered across different backends as needs and good patterns emerge. For anything you can't do through the core Storex API, the backends you're using should expose the lower layers for you to play around with (like the Sequelize models for SQL databases or the Dexie object for IndexedDB.)

collection(name : string).createObject(<object>[, <options>])
===========================================================

Creates a new object and any necessary child objects, cleaning and preparing necessay fields before inserting them into the DB. For the creation of objects with children, see [Relations](./collections.md#relationships). `<options>` for now is empty, but will be the place to pass additional instructions to the back-end while creating the objects.

**Returns**: Object with database generated and cleaned fields (auto-increment primary keys, random keys, etc.) and child objects created.

**Example**:

```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            activationCode: { type: 'random-key' }
        },
        indices: []
    },
})

const email = await storageManager.collection('email').createObject({address: 'boo@bla.com', isActive: false})
console.log(email.activationCode) // Some random string
```

collection(name : string).updateObjects(<filter>, <object>[, <options>])
========================================================================

Updates all objects matching `<filter>`, which a MongoDB-like filter.

**Example**:

```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            activationCode: { type: 'random-key' }
        },
        indices: []
    },
})

const email = await storageManager.collection('email').createObject({address: 'boo@bla.com', isActive: false})
console.log(email.isActive) // false

await storageManager.collection('email').updateObjects({address: 'boo@bla.com'}, {isActive: true})
console.log((await storageManager.collection('email').findOneObject({address: 'boo@bla.com'})).isActive) // false
```

collection(name : string).deleteObjects(<filter>[, <options>])
========================================================================

Deletes all objects from the database matching `<filter>`, which a MongoDB-like filter. Pass in `{}` as `<filter>` to delete all objects from DB.

**Example**:

```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            activationCode: { type: 'random-key' }
        },
        indices: []
    },
})

const email = await storageManager.collection('email').createObject({address: 'boo@bla.com', isActive: false})
await storageManager.collection('email').deleteObjects({address: 'boo@bla.com'})
```

collection(name : string).findObjects(<filter>[, <options>])
============================================================

Fetches all objects from a collection matching `filter`. Currently supported `options` for Dexie back-end include:
* `limit`: number
* `skip`: number, skip the first x number of objects
* `reverse`: boolean, reverse ordering of result set
* `ignoreCase`: array of field names, field names to ignore case for while searching

Example:

```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            activationCode: { type: 'random-key' }
        },
        indices: []
    },
})

await storageManager.collection('email').createObject({address: 'foo@bla.com', isActive: false})
await storageManager.collection('email').createObject({address: 'bar@bla.com', isActive: false})
console.log(await storageManager.collection('email').findObjects({isActive: false}))
# [{address: 'foo@bla.com', isActive: false}, {address: 'bar@bla.com', isActive: false}]
```

collection(name : string).findOneObject(<filter>[, <options>])
============================================================

Fetches a single objects from a collection matching `filter`. Currently supported `options` for Dexie back-end include:
* `reverse`: boolean, reverse ordering of result set
* `ignoreCase`: array of field names, field names to ignore case for while searching

Example:

```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            activationCode: { type: 'random-key' }
        },
        indices: []
    },
})

await storageManager.collection('email').createObject({address: 'foo@bla.com', isActive: false})
await storageManager.collection('email').createObject({address: 'bar@bla.com', isActive: false})
console.log(await storageManager.collection('email').findObjects({address: 'foo@bla.com'}))
# {address: 'foo@bla.com', isActive: false}
```
