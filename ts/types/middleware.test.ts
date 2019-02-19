const expect = require('expect')
import { createTestStorageManager, generateTestObject } from '../index.tests'
import { StorageMiddleware } from './middleware';

describe('Middleware', () => {
    it('it should run middleware in the right order', async () => {
        const calls = []
        const middleware : StorageMiddleware[] = [
            {process: async ({operation, next}) => {
                calls.push({which: 'first', operation})
                return {...await next.process({operation}), first: 1}
            }},
            {process: async ({operation, next}) => {
                calls.push({which: 'second', operation})
                return {...await next.process({operation}), second: 2}
            }},
        ]

        const storageManager = await createTestStorageManager({
            configure: () => null,
            operation: async (...args) => ({args})
        } as any)
        storageManager.setMiddleware(middleware)

        expect(await storageManager.collection('user').createObject({foo: 'test'})).toEqual({
            args: ['createObject', 'user', {foo: 'test'}],
            first: 1,
            second: 2,
        })
        expect(calls).toEqual([
            {which: 'first', operation: ['createObject', 'user', {foo: 'test'}]},
            {which: 'second', operation: ['createObject', 'user', {foo: 'test'}]},
        ])
    })
})
