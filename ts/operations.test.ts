import * as expect from 'expect'
import { OperationRegistry, substituteOperationPlaceholders } from './operations'

describe('Operation registry', () => {
    it('should be able to register operations', () => {
        const operationRegistry = new OperationRegistry()
        const id = operationRegistry.register('createObject', {
            name: '$name:string$'
        })
        expect(id).toEqual('operation:2b838b2686841641bfcbe1424965a157247c3961')
        expect(operationRegistry.getAll()).toEqual({
            [id]: {
                type: 'createObject',
                args: [{name: '$name:string$'}]
            }
        })
    })
})

describe('Registered operation placeholders', () => {
    it('should be able to replace string placeholders', () => {
        expect(substituteOperationPlaceholders({type: 'test', args: [
            {test: {name: '$name:string$'}}, {test: [{name: '$foo:string$'}]}
        ]}, {name: 'joe', foo: 'eggs'})).toEqual([
            {test: {name: 'joe'}}, {test: [{name: 'eggs'}]}
        ])
    })
})
