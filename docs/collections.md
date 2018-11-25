Collections are defined by calls to the StorageRegistry.registerCollection(s) function:

```
storageManager.registry.registerCollections({
    user: {
        version: new Date(2018, 11, 11),
        fields: {
            identifier: { type: 'string' },
            isActive: { type: 'boolean' },
        },
        indices: [
            { field: 'identifier' },
        ]
    },
    todoList: {
        version: new Date(2018, 7, 11),
        fields: {
            title: { type: 'string' },
        },
        relationships: [
            {childOf: 'user'} # creates one-to-many relationship
        ],
        indices: []
    },
})
```

The versions are grouped by date, which could be a release date for example. This allows Storex to give you a history of all your collection versions for data model migration purposes. To access the list of versions, you can use the StorageRegistry.collectionsByVersion map of which the key is the timestamp, and the value is an object mapping collectionName -> collectionDefinition.

Field types
===========

Currently built-in field types are `string`, `text`, `json`, `datetime`, `timestamp`, `boolean`, `float`, `int`, `blob` and `binary`.

**String and text fields:** If you place an index `text` field, it will be marked to be indexed for full-text search.

**JSON fields:** You can pass in JSON-serializable values here, which will be stored by the back-end in the fast, and possibly queryable way. Serialization and deserialization happens automatically on store/retrieval if needed.

**Datetime and timestamp fields:** Depending on preferences, this allows you to either store/retrieve Date objects, or milisecond timestamps.

**Blob and binary fields:** TODO

### Custom fields

You can register your own custom field types, which allows you to do some pre-storage/post-retrieval processing, optionally allowing you to signal to the back-end which of the above primitive field types to store its value as. An example can be found [here](../ts/fields/random-key.ts).

Relationships
=============

You can define three kinds of relationships between collections. `singleChildOf`, `childOf` and `connects`. Each of allows you to multiple connected objects in one call. In the future they will allow also you to fetch related objects when retrieving data, and to filter objects based on their relationships.

### singleChildOf

Creates a one-to-one relationship:
```
storageManager.registry.registerCollections({
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isActive: { type: 'boolean' },
        },
        indices: []
    },
    activationCode: {
        version: new Date(2018, 7, 11),
        fields: {
            key: { type: 'string' },
        },
        relationships: [
            {
                childOf: 'email',
                // alias: 'emailToBeActivated', // Defaults to the name of the parent collection
                // reverseAlias: 'code' // Defaults to the name of this collection, used to create child objects directly when creating the parent objects
            }
        ],
        indices: []
    },
})
await storageManger.finishInitialization()

const email = await storageManager.collection('email').createObject({address: 'boo@bla.com', isActive: false, activationCode: {key: 'thekey'}})
console.log(email.activationCode)

// The parent objects pk is stored on the child object on the configured alias field
const key = await storageManager.collection('activationCode').findOneObject({email: email.id'})
```

### childOf

Creates a one-to-many relationship:
```
storageManager.registry.registerCollections({
    user: {
        version: new Date(2018, 11, 11),
        fields: {
            displayName: { type: 'string' },
        },
        indices: [],
    },
    email: {
        version: new Date(2018, 11, 11),
        fields: {
            address: { type: 'string' },
            isPrimary: { type: 'boolean' },
            isActive: { type: 'boolean' },
        },
        relationships: [
            {
                childOf: 'user',
                // alias: 'owner', // Defaults to the name of the parent collection
                // reverseAlias: 'usedEmails' // Defaults to the plural name of this collection, used to create child objects directly when creating the parent objects
            }
        ],
        indices: [],
    },
})
await storageManger.finishInitialization()

const user = await storageManager.collection('user').createObject({displayName: 'Joe', emails: [
    {address: 'joe@primary.com', isPrimary: true, isActive: true},
    {address: 'joe@secondary.com', isPrimary: false, isActive: true},
]})

// The parent objects pk is stored on child objects on the configured alias field
const emails = await storageManager.collection('activationCode').findObjects({user: user.id'})
```

### connects

Creates a many-to-many relationship by explictly defining a connection between them:
```
storageManager.registry.registerCollections({
    user: {
        version: new Date(2018, 11, 11),
        fields: {
            displayName: { type: 'string' },
        },
        indices: [],
    },
    newsletter: {
        version: new Date(2018, 11, 11),
        fields: {
            title: { type: 'string' },
        },
        relationships: [
            {
                childOf: 'user',
                alias: 'owner',
            },
        ],
        indices: [],
    },
    subscription: {
        version: new Date(2018, 11, 11),
        fields: {
            isActive: { type: 'boolean' }
        },
        relationships: [
            {
                connects: ['user', 'newsletter'],
                aliases: ['subscriber', 'newsletter'],
                reverseAliases: ['newsletterSubscriptions', 'subscriptions'],
            },
        ],
        indices: [],
    }
})
await storageManger.finishInitialization()

// For now, you'll have to create and retrieve parents, children and connections between them manually until we figure out a nice way to make this easier.
const user = await storageManager.collection('user').createObject({displayName: 'Joe'})
const newsletter = await storageManager.collection('newsletter').createObject({title: 'The blahoo'})
const subscription = await storageManager.collection('newsletter').createObject({subscriber: user.id, newsletter: newsletter.id})
```

Indices
=======

TBD
