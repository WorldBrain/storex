import * as expect from 'expect'
import StorageManager from '.'
import { StorageBackend } from './types'

export function createTestStorageManager(backend: StorageBackend) {
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
                expiry: { type: 'datetime' }
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
    storageManager.finishInitialization()

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
    describe('Basics with auth example', () => {
        testStorageBackendWithAuthExample(backendCreator)
    })
    if (fullTextSearch) {
        describe('Full text search', () => {
            testStorageBackendFullTextSearch(backendCreator)
        })
    }
}

export function testStorageBackendWithAuthExample(backendCreator: () => Promise<StorageBackend>) {
    let backend: StorageBackend
    let storageManager: StorageManager

    beforeEach(async () => {
        backend = await backendCreator()
        storageManager = createTestStorageManager(backend)
        await backend.migrate()
    })

    afterEach(async () => {
        await backend.cleanup()
    })

    it('should do basic CRUD ops', async () => {
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
