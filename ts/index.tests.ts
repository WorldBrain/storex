import * as expect from 'expect'
import StorageManager from '.'
import { StorageBackend } from './types'

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
                code: { type: 'random-key' },
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
                    expires
                }
            }
        ]
    }
}

export function testStorageBackend(backendCreator: () => Promise<StorageBackend>, {fullTextSearch} : {fullTextSearch? : boolean} = {}) {
    describe('Individual operations', () => {
        testStorageBackendOperations(backendCreator)
    })
    
    describe('Basics with auth example', () => {
        testStorageBackendWithAuthExample(backendCreator)
    })

    if (fullTextSearch) {
        describe('Full text search', () => {
            testStorageBackendFullTextSearch(backendCreator)
        })
    }
}

export function testStorageBackendWithAuthExample(backendCreator: () => Promise<StorageBackend>, backendCleaner?: () => Promise<void>) {
    async function setupTest() {
        const backend = await backendCreator()
        const storageManager = await createTestStorageManager(backend)
        await backend.migrate()
        return { storageManager }
    }

    it('should do basic CRUD ops', async () => {
        const { storageManager } = await setupTest()
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
                verificationCode: expect['objectContaining']({})
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

    it('should handle connects relationships correctly', async () => {
        const { storageManager } = await setupTest()
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
        expect(retrievedSubscription).toMatchObject({
            user: createdUser['id'],
            newsletter: createdNewsletter['id'],
        })
    })
}

export function testStorageBackendFullTextSearch(backendCreator: () => Promise<StorageBackend>) {
    let backend: StorageBackend

    beforeEach(async () => {
        backend = await backendCreator()
        await backend.migrate()
    })

    afterEach(async () => {
        await backend.cleanup()
    })

    const createTestStorageManager = () => {
        const storageManager = new StorageManager({ backend })
        storageManager.registry.registerCollections({
            pages: {
                version: new Date(2018, 9, 13),
                fields: {
                    url: {type: 'string'},
                    text: {type: 'string'},
                },
                indices: [{field: 'text'}]
            }
        })
        storageManager.finishInitialization()
        return storageManager
    }

    it('should do full-text search of whole words', async function() {
        if (!backend.supports('fullTextSearch')) {
            this.skip()
        }

        const storageManager = createTestStorageManager()
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

export function testStorageBackendOperations(backendCreator : () => Promise<StorageBackend>) {
    async function setupUserAdminTest() {
        const backend = await backendCreator()
        const storageManager = await createTestStorageManager(backend)
        await storageManager.backend.migrate()
        return { backend, storageManager }
    }

    async function setupChildOfTest({userFields = null} = {}) {
        const backend = await backendCreator()
        const storageManager = new StorageManager({backend})
        await storageManager.backend.migrate()
        storageManager.registry.registerCollections({
            user: {
                version: new Date(2019, 1, 1),
                fields: userFields || {
                    displayName: {type: 'string'}
                }
            },
            email: {
                version: new Date(2019, 1, 1),
                fields: {
                    address: {type: 'string'}
                },
                relationships: [
                    {childOf: 'user'}
                ]
            }
        })
        await storageManager.finishInitialization()
        return { storageManager }
    }

    async function setupOperatorTest({fieldType}) {
        const backend = await backendCreator()
        const storageManager = new StorageManager({backend})
        await storageManager.backend.migrate()
        storageManager.registry.registerCollections({
            object: {
                version: new Date(2019, 1, 1),
                fields: {
                    field: {type: fieldType}
                }
            },
        })
        await storageManager.finishInitialization()
        return { storageManager }
    }

    it('should be able to create simple objects and find them again by string pk', async () => {
        const { storageManager } = await setupUserAdminTest()
        const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
        expect(object.id).not.toBe(undefined)
        const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
        expect(foundObject).toEqual({
            id: object.id,
            identifier: 'email:joe@doe.com', isActive: true
        })
    })

    it('should be able to create simple objects and find them again by string field', async () => {
        const { storageManager } = await setupUserAdminTest()
        const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
        expect(object.id).not.toBe(undefined)
        const foundObject = await storageManager.collection('user').findOneObject({identifier: 'email:joe@doe.com'})
        expect(foundObject).toEqual({
            id: object.id,
            identifier: 'email:joe@doe.com', isActive: true
        })
    })

    it('should be able to create simple objects and find them again by boolean field', async () => {
        const { storageManager } = await setupUserAdminTest()
        const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: true})
        expect(object.id).not.toBe(undefined)
        const foundObject = await storageManager.collection('user').findOneObject({isActive: true})
        expect(foundObject).toEqual({
            id: object.id,
            identifier: 'email:joe@doe.com', isActive: true
        })
    })

    it('should be able to find by $lt operator', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 3})
        const results = await storageManager.collection('object').findObjects({field: {$lt: 3}})
        expect(results).toContainEqual(expect.objectContaining({field: 1}))
        expect(results).toContainEqual(expect.objectContaining({field: 2}))
    })

    it('should be able to find by $lte operator', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 3})
        const results = await storageManager.collection('object').findObjects({field: {$lte: 2}})
        expect(results).toContainEqual(expect.objectContaining({field: 1}))
        expect(results).toContainEqual(expect.objectContaining({field: 2}))
    })

    it('should be able to find by $gt operator', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 3})
        const results = await storageManager.collection('object').findObjects({field: {$gt: 1}})
        expect(results).toContainEqual(expect.objectContaining({field: 2}))
        expect(results).toContainEqual(expect.objectContaining({field: 3}))
    })

    it('should be able to find by $gte operator', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 3})
        const results = await storageManager.collection('object').findObjects({field: {$gte: 2}})
        expect(results).toContainEqual(expect.objectContaining({field: 2}))
        expect(results).toContainEqual(expect.objectContaining({field: 3}))
    })

    it('should be able to order results in ascending order', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 3})
        expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'asc']]})).toEqual([
            expect.objectContaining({field: 1}),
            expect.objectContaining({field: 2}),
            expect.objectContaining({field: 3}),
        ])
    })

    it('should be able to order results in descending order', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 3})
        expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'desc']]})).toEqual([
            expect.objectContaining({field: 3}),
            expect.objectContaining({field: 2}),
            expect.objectContaining({field: 1}),
        ])
    })

    it('should be able to limit ascending results', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 3})
        expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'asc']], limit: 2})).toEqual([
            expect.objectContaining({field: 1}),
            expect.objectContaining({field: 2}),
        ])
    })

    it('should be able to limit descending results', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').createObject({field: 1})
        await storageManager.collection('object').createObject({field: 3})
        expect(await storageManager.collection('object').findObjects({field: {$gte: 1}}, {order: [['field', 'desc']], limit: 2})).toEqual([
            expect.objectContaining({field: 3}),
            expect.objectContaining({field: 2}),
        ])
    })

    it('should be able to update objects by string pk', async () => {
        const { storageManager } = await setupUserAdminTest()
        const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: false})
        expect(object.id).not.toBe(undefined)
        await storageManager.collection('user').updateOneObject({id: object.id}, {isActive: true})
        const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
        expect(foundObject).toEqual({
            id: object.id,
            identifier: 'email:joe@doe.com', isActive: true
        })
    })

    it('should be able to update objects by string field', async () => {
        const { storageManager } = await setupUserAdminTest()
        const { object } = await storageManager.collection('user').createObject({identifier: 'email:joe@doe.com', isActive: false})
        expect(object.id).not.toBe(undefined)
        await storageManager.collection('user').updateObjects({identifier: 'email:joe@doe.com'}, {isActive: true})
        const foundObject = await storageManager.collection('user').findOneObject({id: object.id})
        expect(foundObject).toEqual({
            id: object.id,
            identifier: 'email:joe@doe.com', isActive: true
        })
    })

    it('should correctly do batch operations containing only creates', async () => {
        const { storageManager } = await setupChildOfTest()
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

    it('should support batch operations with complex createObject operations', async () => {
        const { storageManager } = await setupChildOfTest()
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

    it('should support batch operations with compound primary keys')

    it('should be able to do complex creates', async () => {
        const { storageManager } = await setupChildOfTest()
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

    it('should be able to delete single objects by pk', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
        const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
        await storageManager.collection('object').deleteOneObject(object1)
        expect(await storageManager.collection('object').findObjects({})).toEqual([
            expect.objectContaining({id: object2.id})
        ])
    })

    it('should be able to delete multiple objects by pk', async () => {
        const { storageManager } = await setupOperatorTest({fieldType: 'number'})
        const { object: object1 } = await storageManager.collection('object').createObject({field: 1})
        const { object: object2 } = await storageManager.collection('object').createObject({field: 2})
        const { object: object3 } = await storageManager.collection('object').createObject({field: 3})
        await storageManager.collection('object').deleteObjects({id: {$in: [object1.id, object2.id]}})
        const results = await storageManager.collection('object').findObjects({})
        expect(await storageManager.collection('object').findObjects({})).toEqual([
            expect.objectContaining({id: object3.id})
        ])
    })
}
