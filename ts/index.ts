const fromPairs = require('lodash/fromPairs')
import StorageRegistry from './registry'
import { createDefaultFieldTypeRegistry, FieldTypeRegistry } from './fields'
import { StorageMiddleware } from './types/middleware'
import { StorageBackend, COLLECTION_OPERATIONS } from './types/backend'
import StorageManagerInterface, { StorageCollection } from './types/manager'

export { default as StorageRegistry } from './registry'

const COLLECTION_OPERATION_ALIASES = {
    findOneObject: 'findObject',
    findAllObjects: 'findObjects',
    updateOneObject: 'updateObject',
    updateAllObject: 'updateObjects',
    deleteOneObject: 'deleteObject',
    deleteAllObjects: 'deleteObjects',
}

export default class StorageManager implements StorageManagerInterface {
    public registry: StorageRegistry
    public backend: StorageBackend
    private _middleware : StorageMiddleware[]

    constructor({ backend, middleware = [], fieldTypes }: { backend: StorageBackend, middleware? : StorageMiddleware[], fieldTypes?: FieldTypeRegistry }) {
        this.registry = new StorageRegistry({ fieldTypes: fieldTypes || createDefaultFieldTypeRegistry() })
        this.backend = backend
        this.backend.configure({ registry: this.registry })
        this._middleware = middleware
        this._middleware.reverse()
    }

    async finishInitialization() {
        await this.registry.finishInitialization()
        for (const middleware of this._middleware) {
            if (middleware.setup) {
                middleware.setup({storageManager: this})
            }
        }
    }

    collection(collectionName: string): StorageCollection {
        const operation = operationName => (...args) => this.operation(operationName, collectionName, ...args)
        return fromPairs([
            ...Array.from(COLLECTION_OPERATIONS).map(
                operationName => [operationName, operation(operationName)]
            ),
            ...Object.entries(COLLECTION_OPERATION_ALIASES).map(
                ([alias, target]) => [alias, operation(target)]
            )
        ])
    }

    async operation(operationName : string, ...args) {
        let next = {process: ({operation}) => this.backend.operation(operation[0], ...operation.slice(1))}
        for (const middleware of this._middleware) {
            const currentNext = next
            next = {process: args => middleware.process({...args, next: currentNext})}
        }

        return next.process({operation: [operationName, ...args]})
    }
}

export * from './types'
