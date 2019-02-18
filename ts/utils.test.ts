const expect = require('expect')
const omit = require('lodash/omit')
import { createTestStorageManager, generateTestObject } from './index.tests'
import { dissectCreateObjectOperation, convertCreateObjectDissectionToBatch, setIn } from './utils';

describe('Create object operation dissecting', () => {
    it('should correctly dissect a createObject operation with no relationships', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        delete testObject['emails']
        expect(dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry)).toEqual({
            objects: [
                {
                    placeholder: 1,
                    collection: 'user',
                    path: [],
                    object: omit(testObject, 'emails'),
                    relations: {}
                },
            ]
        })
    })

    it('should correctly dissect a createObject operation childOf relationships', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        delete testObject.emails[0].verificationCode
        expect(dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry)).toEqual({
            objects: [
                {
                    placeholder: 1,
                    collection: 'user',
                    path: [],
                    object: omit(testObject, 'emails'),
                    relations: {},
                },
                {
                    placeholder: 2,
                    collection: 'userEmail',
                    path: ['emails', 0],
                    object: omit(testObject.emails[0], 'verificationCode'),
                    relations: {
                        user: 1
                    },
                },
            ]
        })
    })

    it('should correctly dissect a createObject operation childOf and singleChildOf relationships', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        expect(dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry)).toEqual({
            objects: [
                {
                    placeholder: 1,
                    collection: 'user',
                    path: [],
                    object: omit(testObject, 'emails'),
                    relations: {},
                },
                {
                    placeholder: 2,
                    collection: 'userEmail',
                    path: ['emails', 0],
                    object: omit(testObject.emails[0], 'verificationCode'),
                    relations: {
                        user: 1
                    },
                },
                {
                    placeholder: 3,
                    collection: 'userEmailVerificationCode',
                    path: ['emails', 0, 'verificationCode'],
                    object: omit(testObject.emails[0].verificationCode),
                    relations: {
                        userEmail: 2
                    },
                },
            ]
        })
    })

    it('should correctly dissect a createObject operation childOf and singleChildOf relationships with custom placeholder generation', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        expect(dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry, {
            generatePlaceholder: (() => {
                let placeholdersGenerated = 0
                return () => `custom-${++placeholdersGenerated}`
            })(),
        })).toEqual({
            objects: [
                {
                    placeholder: 'custom-1',
                    collection: 'user',
                    path: [],
                    object: omit(testObject, 'emails'),
                    relations: {},
                },
                {
                    placeholder: 'custom-2',
                    collection: 'userEmail',
                    path: ['emails', 0],
                    object: omit(testObject.emails[0], 'verificationCode'),
                    relations: {
                        user: 'custom-1'
                    },
                },
                {
                    placeholder: 'custom-3',
                    collection: 'userEmailVerificationCode',
                    path: ['emails', 0, 'verificationCode'],
                    object: omit(testObject.emails[0].verificationCode),
                    relations: {
                        userEmail: 'custom-2'
                    },
                },
            ]
        })
    })
})

describe('Converting dissected create operation to batch', () => {
    it('should work', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        const dissection = dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry)
        expect(convertCreateObjectDissectionToBatch(dissection)).toEqual([
            {
                placeholder: '1',
                operation: 'createObject',
                collection: 'user',
                args: omit(testObject, 'emails'),
                replace: [],
            },
            {
                placeholder: '2',
                operation: 'createObject',
                collection: 'userEmail',
                args: omit(testObject.emails[0], 'verificationCode'),
                replace: [{
                    path: 'user',
                    placeholder: '1',
                }]
            },
            {
                placeholder: '3',
                operation: 'createObject',
                collection: 'userEmailVerificationCode',
                args: testObject.emails[0].verificationCode,
                replace: [{
                    path: 'userEmail',
                    placeholder: '2',
                }]
            },
        ])
    })

    it('should work keep placeholders', async () => {
        const storageManager = await createTestStorageManager({
            configure: () => null
        } as any)

        const testObject = generateTestObject({email: 'foo@test.com', passwordHash: 'notahash', expires: 10})
        const dissection = dissectCreateObjectOperation({
            operation: 'createObject',
            collection: 'user',
            args: testObject
        }, storageManager.registry, {generatePlaceholder: (() => {
            let placeholdersGenerated = 0
            return () => `custom-${++placeholdersGenerated}`
        })()})
        expect(convertCreateObjectDissectionToBatch(dissection)).toEqual([
            {
                placeholder: 'custom-1',
                operation: 'createObject',
                collection: 'user',
                args: omit(testObject, 'emails'),
                replace: [],
            },
            {
                placeholder: 'custom-2',
                operation: 'createObject',
                collection: 'userEmail',
                args: omit(testObject.emails[0], 'verificationCode'),
                replace: [{
                    path: 'user',
                    placeholder: 'custom-1',
                }]
            },
            {
                placeholder: 'custom-3',
                operation: 'createObject',
                collection: 'userEmailVerificationCode',
                args: testObject.emails[0].verificationCode,
                replace: [{
                    path: 'userEmail',
                    placeholder: 'custom-2',
                }]
            },
        ])
    })
})

describe('setIn()', () => {
    it('should modify an object by path', () => {
        const obj = {x: {foo: [{bar: 3}, {bar: 5}]}}
        setIn(obj, ['x', 'foo', 1, 'bar'], 10)
        expect(obj).toEqual({
            x: {foo: [
                {bar: 3},
                {bar: 10}
            ]}
        })
    })
})
