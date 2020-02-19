const fromPairs = require('lodash/fromPairs')
import StorageRegistry from './registry'
import { createDefaultFieldTypeRegistry, FieldTypeRegistry } from './fields'
import { StorageMiddleware, StorageMiddlewareContext } from './types/middleware'
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
    private _middleware: StorageMiddleware[] = []

    constructor({ backend, fieldTypes }: { backend: StorageBackend, fieldTypes?: FieldTypeRegistry }) {
        this.registry = new StorageRegistry({ fieldTypes: fieldTypes || createDefaultFieldTypeRegistry() })
        this.backend = backend
        this.backend.configure({ registry: this.registry })
    }

    setMiddleware(middleware: StorageMiddleware[]) {
        this._middleware = middleware
        this._middleware.reverse()
    }

    async finishInitialization() {
        await this.registry.finishInitialization()
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

    async operation(operationName: string, ...args) {
        let next = {
            process: ({ operation }: StorageMiddlewareContext | Omit<StorageMiddlewareContext, 'next'>) =>
                this.backend.operation(operation[0], ...operation.slice(1))
        }
        let extraData = {}
        for (const middleware of this._middleware) {
            const currentNext = next
            next = {
                process: async args => {
                    extraData = { ...extraData, ...(args.extraData || {}) }
                    const result = await middleware.process({ ...args, extraData, next: currentNext })
                    return result
                }
            }
        }

        return next.process({ operation: [operationName, ...args], extraData })
    }
}

export * from './types'
