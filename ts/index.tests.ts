import expect from 'expect'
import StorageManager from '.'
import { StorageBackend, FieldType, CollectionFields, Relationship, PrimitiveFieldType } from './types'
import { StorageBackendFeatureSupport } from './types/backend-features';
import { FieldTypeRegistry } from './fields';
import { Field } from './fields/types';

export type StorexBackendTestBackendCreator = (context : StorexBackendTestContext) => Promise<StorageBackend>
export interface StorexBackendTestContext {
    cleanupFunction? : () => Promise<void>
}

type TestContext = { backend : StorageBackend }
function makeTestFactory(backendCreator : StorexBackendTestBackendCreator) {
    type FactoryOptions = { shouldSupport? : Array<keyof StorageBackendFeatureSupport> }
    type TestFunction = (context : TestContext) => Promise<void>

    function factory(description : string, test? : TestFunction) : void
    function factory(description : string, options : FactoryOptions, maybeTest? : TestFunction) : void
    function factory(description : string, testOrOptions? : FactoryOptions | TestFunction, maybeTest? : TestFunction) : void {
        const test = typeof testOrOptions !== 'function' ? maybeTest : testOrOptions
        const options = typeof testOrOptions !== 'function' ? testOrOptions : {}

        it(description, test && (async function () {
            const context : StorexBackendTestContext = {}
            const backend = await backendCreator(context)
            await skipIfNotSupported({ backend, shouldSupport: options.shouldSupport, testContext: this })

            const testContext = this
            try {
                await test.call(testContext, { backend })
            } finally {
                if (context.cleanupFunction) {
                    await context.cleanupFunction()
                }
            }
        }))
    }

    return factory
}

export async function createTestStorageManager(backend: StorageBackend) {
    const storageManager = new StorageManager({ backend })
    storageManager.registry.registerCollections({
        user: {
            version: new Date(2018, 7, 31),
            fields: {
                identifier: { type: 'string' },
                passwordHash: { type: 'string', optional: true },
                isActive: { type: 'boolean' },
            },
            indices: [
                { field: 'identifier' },
            ]
        },
        userEmail: {
            version: new Date(2018, 7, 31),
            fields: {
                email: { type: 'string' },
                isVerified: { type: 'boolean' },
                isPrimary: { type: 'boolean' },
            },
            relationships: [
                { childOf: 'user', reverseAlias: 'emails' }
            ],
            indices: [
                { field: [{ relationship: 'user' }, 'email'], unique: true }
            ]
        },
        userEmailVerificationCode: {
            version: new Date(2018, 7, 31),
            fields: {
                code: { type: 'string' },
                expiry: { type: 'datetime', optional: true }
            },
            relationships: [
                { singleChildOf: 'userEmail', reverseAlias: 'verificationCode' }
            ],
            indices: [
                { field: 'code', unique: true }
            ]
        },
        newsletter: {
            version: new Date(2018, 7, 31),
            fields: {
                name: { type: 'string' }
            },
            indices: [
            ]
        },
        newsletterSubscription: {
            version: new Date(2018, 7, 31),
            fields: {
            },
            relationships: [
                { connects: ['user', 'newsletter'] }
            ],
            indices: [
            ]
        }
    })
    await storageManager.finishInitialization()

    return storageManager
}

export function generateTestObject(
    { email = 'blub@bla.com', passwordHash = 'hashed!', expires }:
        { email: string, passwordHash: string, expires: number }) {
    return {
        identifier: `email:${email}`,
        passwordHash,
        isActive: false,
        emails: [
            {
                email,
                isVerified: false,
                isPrimary: true,
                verificationCode: {
                    code: 'bla',
                    expires
                }
            }
        ]
    }
}

async function skipIfNotSupported(options : {
    backend : StorageBackend, testContext? : Mocha.ITestCallbackContext, shouldSupport? : string[],
}) {
    for (const feature of options.shouldSupport || []) {
        if (!options.backend.supports(feature)) {
            options.testContext.skip()
        }
    }
}

export function testStorageBackend(backendCreator: StorexBackendTestBackendCreator, {fullTextSearch} : {fullTextSearch? : boolean} = {}) {
    describe('Setup', () => {
        testStorageBackendSetup(backendCreator)
    })
    
    describe('Individual operations', () => {
        testStorageBackendOperations(backendCreator)
    })
    
    describe('Auth example', () => {
        testStorageBackendWithAuthExample(backendCreator)
    })

    if (fullTextSearch) {
        describe('Full text search', () => {
            testStorageBackendFullTextSearch(backendCreator)
        })
    }
}

export function testStorageBackendSetup(backendCreator: StorexBackendTestBackendCreator) {
    const it = makeTestFactory(backendCreator)
    
    it('should throw no errors trying to set up a collection with indexed fields', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            pages: {
                version: new Date(2018, 9, 13),
                fields: {
                    url: {type: 'string'},
                    text: {type: 'text'},
                },
                indices: [{field: 'text'}]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })

    it('should throw no errors trying to set up a collection with indexed childOf relations', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page' }
                ],
                indices: [
                    { field: { relationship: 'page' } }
                ]
            }

        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })

    it('should throw no errors trying to set up a collection with indexed childOf relations with custom aliases', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page', alias: 'thePage' }
                ],
                indices: [
                    { field: { relationship: 'thePage' } }
                ]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })
    
    it('should throw no errors trying to set up a collection with indexed childOf relations with custom aliases and fieldNames', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page', alias: 'thePage', fieldName: 'thePageField' }
                ],
                indices: [
                    { field: { relationship: 'thePage' } }
                ]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })

    it('should throw no errors trying to set up a collection with indexed singleChildOf relations', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page' }
                ],
                indices: [
                    { field: { relationship: 'page' } }
                ]
            }

        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })

    it('should throw no errors trying to set up a collection with indexed singleChildOf relations with custom aliases', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page', alias: 'thePage' }
                ],
                indices: [
                    { field: { relationship: 'thePage' } }
                ]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })
    
    it('should throw no errors trying to set up a collection with indexed singleChildOf relations with custom aliases and fieldNames', async (context : TestContext) => {
        const storageManager = new StorageManager({ backend: context.backend })
        storageManager.registry.registerCollections({
            page: {
                version: new Date(2018, 9, 13),
                fields: {
                    text: {type: 'text'},
                },
            },
            note: {
                version: new Date(2018, 9, 13),
                fields: {},
                relationships: [
                    { childOf: 'page', alias: 'thePage', fieldName: 'thePageField' }
                ],
                indices: [
                    { field: { relationship: 'thePage' } }
                ]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
    })
}

export function testStorageBackendWithAuthExample(backendCreator: StorexBackendTestBackendCreator) {
    const it = makeTestFactory(backendCreator)

    async function setupTest(options : { context : TestContext }) {
        const storageManager = await createTestStorageManager(options.context.backend)
        await options.context.backend.migrate()
        return { storageManager }
    }

    it('should do basic CRUD ops with relationships' , { shouldSupport: ['createWithRelationships'] }, async function(context : TestContext) {
        const { storageManager } = await setupTest({ context })
        const email = 'blub@bla.com', passwordHash = 'hashed!', expires = Date.now() + 1000 * 60 * 60 * 24
        const { object: user } = await storageManager.collection('user').createObject(generateTestObject({ email, passwordHash, expires }))
        expect(user).toMatchObject({
            identifier: 'email:blub@bla.com',
            passwordHash: 'hashed!',
            isActive: false,
            emails: [{
                email: 'blub@bla.com',
                isVerified: false,
                isPrimary: true,
                verificationCode: expect['objectContaining']({ code: 'bla' })
            }]
        })

        await storageManager.collection('user').updateObjects({id: user.id}, {isActive: true})
        expect(await storageManager.collection('user').findOneObject({id: user.id})).toMatchObject({
            id: user.id,
            identifier: user.identifier,
            isActive: true
        })

        await storageManager.collection('user').deleteObjects({id: user.id})
        expect(await storageManager.collection('user').findOneObject({id: user.id})).toBe(null)
    })

    it('should handle connects relationships correctly', async function(context : TestContext) {
        const { storageManager } = await setupTest({ context })
        const email = 'something@foo.com', passwordHash = 'notahash'
        const createdUser = (await storageManager.collection('user').createObject({
            identifier: `email:${email}`,
            passwordHash,
            isActive: true,
        })).object
        const createNewsletter = async () => (await storageManager.collection('newsletter').createObject({
            name: 'test newsletter',
        })).object
        await createNewsletter() // Just to bump the ID of the real obj we're interested in
        const createdNewsletter = await createNewsletter()
        const createdSubscription = (await storageManager.collection('newsletterSubscription').createObject({
            user: createdUser['id'],
            newsletter: createdNewsletter['id'],
        })).object
        const retrievedSubscription = await storageManager.collection('newsletterSubscription').findOneObject({
            id: createdSubscription['id']
        })
        expect(retrievedSubscription).toEqual({
            id: expect.anything(),
            user: createdUser['id'],
            newsletter: createdNewsletter['id'],
        })
    })
}

export function testStorageBackendFullTextSearch(backendCreator: StorexBackendTestBackendCreator) {
    const it = makeTestFactory(backendCreator)

    const createTestStorageManager = async function(options : { context : TestContext }) {
        const storageManager = new StorageManager({ backend: options.context.backend })
        storageManager.registry.registerCollections({
            pages: {
                version: new Date(2018, 9, 13),
                fields: {
                    url: {type: 'string'},
                    text: {type: 'text'},
                },
                indices: [{field: 'text'}]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
        return storageManager
    }

    it('should do full-text search of whole words', async function(context : TestContext) {
        if (!context.backend.supports('fullTextSearch')) {
            this.skip()
        }

        const storageManager = await createTestStorageManager({ context })
        await storageManager.collection('pages').createObject({
            url: 'https://www.test.com/',
            text: 'testing this stuff is not always easy'
        })

        const results = await storageManager.collection('pages').findObjects({text: ['easy']})
        expect(results).toMatchObject([
            {
                url: 'https://www.test.com/',
                text: 'testing this stuff is not always easy',
            }
        ])
    })
}

export function testStorageBackendOperations(backendCreator : StorexBackendTestBackendCreator) {
    const it = makeTestFactory(backendCreator)

    async function setupUserAdminTest(options : { context : TestContext }) {
        const storageManager = await createTestStorageManager(options.context.backend)
        await storageManager.backend.migrate()
        return { backend: options.context.backend, storageManager }
    }

    async function setupChildOfTest(options : {
        backend : StorageBackend,
        userFields? : CollectionFields, emailFields? : CollectionFields,
        relationshipType? : 'childOf' | 'singleChildOf',
        relationshipOptions? : Partial<Relationship>
    }) {
        const relationshipOptions = options.relationshipOptions || {}
        const relationshipType = options.relationshipType || 'childOf'

        const storageManager = new StorageManager({ backend: options.backend })
        storageManager.registry.registerCollections({
            user: {
                version: new Date(2019, 1, 1),
                fields: options.userFields || {
                    displayName: { type: 'string' }
                }
            },
            email: {
                version: new Date(2019, 1, 1),
                fields: options.emailFields || {
                    address: { type: 'string' }
                },
                relationships: [
                    { [relationshipType as any]: 'user', ...relationshipOptions } as any
                ]
            }
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
        return { storageManager }
    }

    async function setupOperatorTest(options : {
        context : TestContext, fieldType? : FieldType,
        fieldTypes? : FieldTypeRegistry, fields? : CollectionFields
        shouldSupport? : string[], testContext? : Mocha.ITestCallbackContext
    }) {
        await skipIfNotSupported({ backend: options.context.backend, ...options })
        const storageManager = new StorageManager({ backend: options.context.backend, fieldTypes: options.fieldTypes })
        storageManager.registry.registerCollections({
            object: {
                version: new Date(2019, 1, 1),
                fields: options.fields || {
                    field: { type: options.fieldType }
                }
            },
        })
        await storageManager.finishInitialization()
        await storageManager.backend.migrate()
        return { storageManager }
    }

    describe('creating and simple finding', () => {
        it('should be able to create simple objects and find them again by pk', async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
            expect(object.id).not.toBe(undefined)
            const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
            expect(foundObject).toEqual({
                id: object.id,
                identifier: 'email:joe@doe.com', isActive: true
            })

            expect(await storageManager.collection('user').findOneObject({
                id: typeof object.id === 'string' ? object.id + 'bla' : object.id + 1
            })).toEqual(null)
        })

        it('should be able to create simple objects and find them again by string field', async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
            expect(object.id).not.toBe(undefined)
            
            const foundObject = await storageManager.collection('user').findOneObject({identifier: 'email:joe@doe.com'})
            expect(foundObject).toEqual({
                id: object.id,
                identifier: 'email:joe@doe.com', isActive: true
            })

            expect(await storageManager.collection('user').findOneObject({identifier: 'email:bla!!!'})).toEqual(null)
        })

        it('should be able to create simple objects and find them again by boolean field', async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
            expect(object.id).not.toBe(undefined)
            const foundObject = await storageManager.collection('user').findOneObject({isActive: true})
            expect(foundObject).toEqual({
                id: object.id,
                identifier: 'email:joe@doe.com', isActive: true
            })
            expect(await storageManager.collection('user').findOneObject({isActive: false})).toBe(null)
        })

        it('should be able to bulk create objects and find them again', { shouldSupport: ['rawCreateObjects'] }, async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const data = [
                {identifier: 'email:joe@doe.com', isActive: true, passwordHash: '123'},
                {identifier: 'email:jane@doe.com', isActive: true, passwordHash: '456'},
            ]
            const { objects } = await storageManager.collection('user').rawCreateObjects(data, {withNestedObjects: false})

            const foundObjects = await storageManager.collection('user').findObjects({isActive: true})
            expect(foundObjects).toEqual(data.map((record,index) => {
                record['id'] = index + 1;
                return record
            }))
            expect(await storageManager.collection('user').findOneObject({isActive: false})).toBe(null)
        })
    })

    describe('where clause operators', () => {
        it('should be able to find by $lt operator', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 3})
            const results = await storageManager.collection('object').findObjects({field: {$lt: 3}})
            expect(results).toContainEqual(expect.objectContaining({field: 1}))
            expect(results).toContainEqual(expect.objectContaining({field: 2}))
            expect(results).not.toContainEqual(expect.objectContaining({field: 3}))
        })

        it('should be able to find by $lte operator', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 3})
            const results = await storageManager.collection('object').findObjects({field: {$lte: 2}})
            expect(results).toContainEqual(expect.objectContaining({field: 1}))
            expect(results).toContainEqual(expect.objectContaining({field: 2}))
            expect(results).not.toContainEqual(expect.objectContaining({field: 3}))
        })

        it('should be able to find by $gt operator', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 3})
            const results = await storageManager.collection('object').findObjects({field: {$gt: 1}})
            expect(results).toContainEqual(expect.objectContaining({field: 2}))
            expect(results).toContainEqual(expect.objectContaining({field: 3}))
            expect(results).not.toContainEqual(expect.objectContaining({field: 1}))
        })

        it('should be able to find by $gte operator', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })

            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 3})
            const results = await storageManager.collection('object').findObjects({field: {$gte: 2}})
            expect(results).toContainEqual(expect.objectContaining({field: 2}))
            expect(results).toContainEqual(expect.objectContaining({field: 3}))
            expect(results).not.toContainEqual(expect.objectContaining({field: 1}))
        })
    })

    describe('sorting', () => {
        it('should be able to order results in ascending order', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int', shouldSupport: ['singleFieldSorting'], testContext: this
            })
            
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 3})
            expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'asc']]})).toEqual([
                expect.objectContaining({field: 1}),
                expect.objectContaining({field: 2}),
                expect.objectContaining({field: 3}),
            ])
        })

        it('should be able to order results in descending order', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int', shouldSupport: ['singleFieldSorting'], testContext: this
            })

            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 3})
            expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'desc']]})).toEqual([
                expect.objectContaining({field: 3}),
                expect.objectContaining({field: 2}),
                expect.objectContaining({field: 1}),
            ])
        })
    })

    describe('limiting', () => {
        it('should be able to limit ascending results', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int', shouldSupport: ['singleFieldSorting', 'resultLimiting'], testContext: this
            })
            
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 3})
            expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'asc']], limit: 2})).toEqual([
                expect.objectContaining({field: 1}),
                expect.objectContaining({field: 2}),
            ])
        })

        it('should be able to limit descending results', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int', shouldSupport: ['singleFieldSorting', 'resultLimiting'], testContext: this
            })
            
            await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').createObject({field: 1})
            await storageManager.collection('object').createObject({field: 3})
            expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'desc']], limit: 2})).toEqual([
                expect.objectContaining({field: 3}),
                expect.objectContaining({field: 2}),
            ])
        })
    })

    describe('updating', () => {
        it('should be able to update objects by string pk', async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: false})
            expect(object.id).not.toBe(undefined)
            await storageManager.collection('user').updateOneObject({id: object.id}, {isActive: true})
            const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
            expect(foundObject).toEqual({
                id: object.id,
                identifier: 'email:joe@doe.com', isActive: true
            })
        })

        it('should be able to update objects by string field', async function(context : TestContext) {
            const { storageManager } = await setupUserAdminTest({ context })
            const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: false})
            expect(object.id).not.toBe(undefined)
            await storageManager.collection('user').updateObjects({identifier: 'email:joe@doe.com'}, {isActive: true})
            const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
            expect(foundObject).toEqual({
                id: object.id,
                identifier: 'email:joe@doe.com', isActive: true
            })
        })
    })

    describe('batching', () => {
        it('should correctly do batch operations containing only creates', { shouldSupport: ['executeBatch'] }, async function(context : TestContext) {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            const { info } = await storageManager.operation('executeBatch', [
                {
                    placeholder: 'jane',
                    operation: 'createObject',
                    collection: 'user',
                    args: {
                        displayName: 'Jane'
                    }
                },
                {
                    placeholder: 'joe',
                    operation: 'createObject',
                    collection: 'user',
                    args: {
                        displayName: 'Joe'
                    }
                },
                {
                    placeholder: 'joeEmail',
                    operation: 'createObject',
                    collection: 'email',
                    args: {
                        address: 'joe@doe.com'
                    },
                    replace: [{
                        path: 'user',
                        placeholder: 'joe',
                    }]
                },
            ])

            expect(info).toEqual({
                jane: {
                    object: expect.objectContaining({
                        id: expect.anything(),
                        displayName: 'Jane',
                    })
                },
                joe: {
                    object: expect.objectContaining({
                        id: expect.anything(),
                        displayName: 'Joe',
                    })
                },
                joeEmail: {
                    object: expect.objectContaining({
                        id: expect.anything(),
                        user: expect.anything(),
                        address: 'joe@doe.com'
                    })
                }
            })
            expect(info['joeEmail']['object']['user']).toEqual(info['joe']['object']['id'])
        })

        it('should support batch operations with complex createObject operations', { shouldSupport: ['executeBatch', 'createWithRelationships'] }, async function(context : TestContext)  {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            const { info } = await storageManager.operation('executeBatch', [
                {
                    placeholder: 'jane',
                    operation: 'createObject',
                    collection: 'user',
                    args: {
                        displayName: 'Jane',
                        emails: [{
                            address: 'jane@doe.com'
                        }]
                    }
                },
                {
                    placeholder: 'joe',
                    operation: 'createObject',
                    collection: 'user',
                    args: {
                        displayName: 'Joe'
                    }
                },
            ])
            expect(info).toEqual({
                jane: {
                    object: {
                        id: expect.anything(),
                        displayName: 'Jane',
                        emails: [{
                            id: expect.anything(),
                            address: 'jane@doe.com'
                        }]
                    }
                },
                joe: {
                    object: {
                        id: expect.anything(),
                        displayName: 'Joe',
                    }
                },
            })
        })

        it('should just ignore empty batch operations', { shouldSupport: ['executeBatch'] }, async function (context : TestContext) {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            await storageManager.operation('executeBatch', [])
        })

        it('should support batch operations with compound primary keys')

        it('should support batches with updateObjects operations', { shouldSupport: ['executeBatch'] }, async function (context : TestContext) {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            const { object: object1 } = await storageManager.collection('user').createObject({displayName: 'Jack'})
            const { object: object2 } = await storageManager.collection('user').createObject({displayName: 'Jane'})
            await storageManager.operation('executeBatch', [
                { operation: 'updateObjects', collection: 'user', where: {id: object1.id}, updates: {displayName: 'Jack 2'} },
                { operation: 'updateObjects', collection: 'user', where: {id: object2.id}, updates: {displayName: 'Jane 2'} },
            ])
            expect([
                await storageManager.collection('user').findOneObject({id: object1.id}),
                await storageManager.collection('user').findOneObject({id: object2.id}),
            ]).toEqual([
                {id: object1.id, displayName: 'Jack 2'},
                {id: object2.id, displayName: 'Jane 2'},
            ])
        })

        it('should support batches with deleteObjects operations', { shouldSupport: ['executeBatch'] }, async function (context : TestContext) {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            const { object: object1 } = await storageManager.collection('user').createObject({displayName: 'Jack'})
            const { object: object2 } = await storageManager.collection('user').createObject({displayName: 'Jane'})
            await storageManager.operation('executeBatch', [
                { operation: 'deleteObjects', collection: 'user', where: {id: object1.id} },
                { operation: 'deleteObjects', collection: 'user', where: {id: object2.id} },
            ])
            expect([
                await storageManager.collection('user').findOneObject({id: object1.id}),
                await storageManager.collection('user').findOneObject({id: object2.id}),
            ]).toEqual([
                null,
                null,
            ])
        })
    })

    describe('complex creates', () => {
        it('should be able to do complex creates', { shouldSupport: ['createWithRelationships'] }, async function(context : TestContext)  {
            const { storageManager } = await setupChildOfTest({ backend: context.backend })
            const { object } = await storageManager.collection('user').createObject({
                displayName: 'Jane',
                emails: [{address: 'jane@doe.com'}]
            })
            expect(object).toEqual({
                id: expect.anything(),
                displayName: 'Jane',
                emails: [{
                    id: expect.anything(),
                    address: 'jane@doe.com',
                }]
            })
            expect(await storageManager.collection('user').findOneObject({id: object.id})).toEqual({
                id: object.id,
                displayName: 'Jane'
            })
            expect(await storageManager.collection('email').findOneObject({id: object.emails[0].id})).toEqual({
                id: object.emails[0].id,
                user: object.id,
                address: 'jane@doe.com'
            })
        })
    })

    describe('deletion', () => {
        it('should be able to delete single objects by pk', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
            const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
            await storageManager.collection('object').deleteOneObject(object1)
            expect(await storageManager.collection('object').findObjects({})).toEqual([
                expect.objectContaining({id: object2.id})
            ])
        })

        it('should be able to delete multiple objects by pk', async function(context : TestContext) {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
            const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
            const { object: object3 } = await storageManager.collection('object').createObject({field: 3})
            await storageManager.collection('object').deleteObjects({id: {$in: [object1.id, object2.id]}})
            const results = await storageManager.collection('object').findObjects({})
            expect(await storageManager.collection('object').findObjects({})).toEqual([
                expect.objectContaining({id: object3.id})
            ])
        })
    })

    describe('counting', () => {
        it('should be able to count all objects', { shouldSupport: ['count'] }, async function(context : TestContext)  {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
            const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
            expect(await storageManager.collection('object').countObjects({})).toEqual(2)
        })

        it('should be able to count objects filtered by field equality', { shouldSupport: ['count'] }, async function(context : TestContext)  {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
            const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
            expect(await storageManager.collection('object').countObjects({ field: 2 })).toEqual(1)
        })

        it('should be able to count objects filtered by field $lt comparison', { shouldSupport: ['count'] }, async function(context : TestContext)  {
            const { storageManager } = await setupOperatorTest({
                context,
                fieldType: 'int'
            })
            const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
            const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
            expect(await storageManager.collection('object').countObjects({ field: {$lt: 2} })).toEqual(1)
        })
    })

    describe('relationships', () => {
        for (const relationshipType of ['childOf', 'singleChildOf'] as ('childOf' | 'singleChildOf')[]) {
            it(`should correctly store objects with ${relationshipType} relationships with a custom fieldName`, async function(context : TestContext) {
                const { storageManager } = await setupChildOfTest({
                    backend: context.backend,
                    relationshipType, relationshipOptions: { fieldName: 'userId' }
                })

                const { object: user } = await storageManager.collection('user').createObject({ displayName: 'Joe' })
                const { object: email } = await storageManager.collection('email').createObject({ user: user.id, address: 'joe@joe.com' })
                expect(email).toEqual({ id: expect.anything(), address: 'joe@joe.com', user: user.id })
            })

            it(`should correctly find objects filtered by ${relationshipType} relationships with a custom fieldName`, async function(context : TestContext) {
                const { storageManager } = await setupChildOfTest({
                    backend: context.backend,
                    relationshipType, relationshipOptions: { fieldName: 'userId' }
                })

                const { object: user } = await storageManager.collection('user').createObject({ displayName: 'Joe' })
                const { object: email } = await storageManager.collection('email').createObject({ user: user.id, address: 'joe@joe.com' })
                expect(await storageManager.collection('email').findObject({ user: user.id })).toEqual(email)
            })

            it(`should correctly delete objects filtered by ${relationshipType} relationships with a custom fieldName`, async function(context : TestContext) {
                const { storageManager } = await setupChildOfTest({
                    backend: context.backend,
                    relationshipType, relationshipOptions: { fieldName: 'userId' }
                })

                const { object: user } = await storageManager.collection('user').createObject({ displayName: 'Joe' })
                const { object: user2 } = await storageManager.collection('user').createObject({ displayName: 'Jack' })
                const { object: email } = await storageManager.collection('email').createObject({ user: user.id, address: 'joe@joe.com' })
                const { object: email2 } = await storageManager.collection('email').createObject({ user: user2.id, address: 'jack@joe.com' })

                await storageManager.collection('email').deleteObjects({ user: user2.id })
                expect(await storageManager.collection('email').findObject({ user: user.id })).toEqual(email)
                expect(await storageManager.collection('email').findObject({ user: user2.id })).toEqual(null)
            })
        }
    })

    describe('custom fields', () => {
        class ReadWriteCustomField extends Field {
            primitiveType : PrimitiveFieldType = 'string'

            async prepareForStorage(value : any) {
                return `Stored: ${value}`
            }

            async prepareFromStorage(value : any) {
                return `Found: ${value}`
            }
        }
        class WriteOnlyCustomField extends Field {
            primitiveType : PrimitiveFieldType = 'string'

            async prepareForStorage(value : any) {
                return `Stored: ${value}`
            }
        }

        async function setupTest(context : TestContext, options : { customField : new () => Field }) {
            const fieldTypes = new FieldTypeRegistry()
            fieldTypes.registerType('random-key', options.customField)

            const { storageManager } = await setupOperatorTest({ context, fieldTypes, fields: {
                fieldString : { type: 'string' },
                fieldCustom : { type: 'random-key', optional: true },
            } })
            return { storageManager }
        }

        it('should correctly process custom fields on create and find', { shouldSupport: ['customFields'] }, async (context : TestContext) => {
            const { storageManager } = await setupTest(context, { customField: ReadWriteCustomField })
            const { object: newObject } = await storageManager.collection('object').createObject({
                fieldString: 'test',
                fieldCustom: 'bla'
            })
            expect(newObject).toEqual({
                id: expect.anything(),
                fieldString: 'test',
                fieldCustom: 'bla'
            })

            const foundObjects = await storageManager.collection('object').findObjects({})
            expect(foundObjects).toEqual([{
                id: newObject.id,
                fieldString: 'test',
                fieldCustom: 'Found: Stored: bla',
            }])
        })

        it(
            'should not try to process custom fields that are not present on object when ' +
            'doing an update on an object without a custom field that modifies both reads and writes present',
            { shouldSupport: ['customFields'] },
            async (context : TestContext) =>
        {
            const { storageManager } = await setupTest(context, { customField: ReadWriteCustomField })
            const { object: newObject } = await storageManager.collection('object').createObject({
                fieldString: 'test'
            })
            expect(newObject).toEqual({
                id: expect.anything(),
                fieldString: 'test'
            })

            const foundObjectsBeforeUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectsBeforeUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'test',
                fieldCustom: 'Found: Stored: undefined',
            }])

            await storageManager.collection('object').updateObjects({ id: newObject.id }, { fieldString: 'new test' })

            const foundObjectAfterUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectAfterUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'new test',
                fieldCustom: 'Found: Stored: undefined',
            }])
        })

        it(
            'should not try to process custom fields that are not present on object when ' +
            'doing an update on an object with a custom field that modifies both reads and writes present',
            { shouldSupport: ['customFields'] },
            async (context : TestContext) =>
        {
            const { storageManager } = await setupTest(context, { customField: ReadWriteCustomField })
            const { object: newObject } = await storageManager.collection('object').createObject({
                fieldString: 'test',
                fieldCustom: 'bla'
            })
            expect(newObject).toEqual({
                id: expect.anything(),
                fieldString: 'test',
                fieldCustom: 'bla',
            })

            const foundObjectsBeforeUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectsBeforeUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'test',
                fieldCustom: 'Found: Stored: bla',
            }])

            await storageManager.collection('object').updateObjects({ id: newObject.id }, { fieldString: 'new test' })

            const foundObjectAfterUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectAfterUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'new test',
                fieldCustom: 'Found: Stored: bla',
            }])
        })

        it(
            'should not try to process custom fields that are not present on object when ' +
            'doing an update without a custom field that only modifies writes present',
            { shouldSupport: ['customFields'] },
            async (context : TestContext) =>
        {
            const { storageManager } = await setupTest(context, { customField: WriteOnlyCustomField })
            const { object: newObject } = await storageManager.collection('object').createObject({
                fieldString: 'test'
            })
            expect(newObject).toEqual({
                id: expect.anything(),
                fieldString: 'test'
            })

            const foundObjectsBeforeUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectsBeforeUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'test',
                fieldCustom: 'Stored: undefined',
            }])

            await storageManager.collection('object').updateObjects({ id: newObject.id }, { fieldString: 'new test' })

            const foundObjectAfterUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectAfterUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'new test',
                fieldCustom: 'Stored: undefined',
            }])
        })

        it(
            'should not try to process custom fields that are not present on object when ' +
            'doing an update with a custom field that only modifies writes present',
            { shouldSupport: ['customFields'] },
            async (context : TestContext) =>
        {
            const { storageManager } = await setupTest(context, { customField: WriteOnlyCustomField })
            const { object: newObject } = await storageManager.collection('object').createObject({
                fieldString: 'test',
                fieldCustom: 'bla',
            })
            expect(newObject).toEqual({
                id: expect.anything(),
                fieldString: 'test',
                fieldCustom: 'bla',
            })

            const foundObjectsBeforeUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectsBeforeUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'test',
                fieldCustom: 'Stored: bla',
            }])

            await storageManager.collection('object').updateObjects({ id: newObject.id }, { fieldString: 'new test' })

            const foundObjectAfterUpdate = await storageManager.collection('object').findObjects({})
            expect(foundObjectAfterUpdate).toEqual([{
                id: newObject.id,
                fieldString: 'new test',
                fieldCustom: 'Stored: bla',
            }])
        })
    })
}
