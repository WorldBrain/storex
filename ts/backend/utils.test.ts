import { expect } from 'chai'
import { createTestStorageManager, generateTestObject } from '../index.tests'
import { FakeStorageBackend } from './index.tests'

describe('StorageBackend utils', () => {
    it('should handle createObject()s with childOf relationships correctly', async () => {
        const ids = {}
        const backend = new FakeStorageBackend({
            idGenerator: collection => {
                ids[collection] = ids[collection] || 0
                return `${collection}-${(++ids[collection]).toString()}`
            }
        })
        const storageManager = await createTestStorageManager(backend)

        const email = 'blub@bla.com', passwordHash = 'hashed!', expires = Date.now() + 1000 * 60 * 60 * 24
        const { object: user } = await storageManager.collection('user').createObject(generateTestObject({email, passwordHash, expires}))

        expect(user).to.deep.equal({
            id: 'user-1',
            identifier: `email:${email}`,
            passwordHash,
            isActive: false,
            emails: [
                {
                    id: 'userEmail-1',
                    user: 'user-1',
                    email,
                    isVerified: false,
                    isPrimary: true,
                    verificationCode: {
                        id: 'userEmailVerificationCode-1',
                        userEmail: 'userEmail-1',
                        expires,
                        code: 'no-so-random-key-1'
                    }
                }
            ]
        })
        expect(backend.createOperations).to.deep.equal([
            {
                id: 'user-1',
                object: {
                    identifier: 'email:blub@bla.com',
                    passwordHash: 'hashed!',
                    isActive: false
                },
            },
            {
                id: 'userEmail-1',
                object:{
                    user: 'user-1',
                    email: 'blub@bla.com',
                    isVerified: false,
                    isPrimary: true,
                },
            },
            {
                id: 'userEmailVerificationCode-1',
                object: {
                    userEmail: 'userEmail-1',
                    expires: expires,
                    code: 'no-so-random-key-1'
                },
            }]
        )
    })
})