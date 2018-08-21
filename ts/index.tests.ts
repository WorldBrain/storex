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

export function testStorageBackend(backendCreator: () => Promise<StorageBackend>) {
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
                verificationCode: expect.objectContaining({})
            }]
        })
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
