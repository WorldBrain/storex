const fromPairs = require('lodash/fromPairs')
import StorageRegistry from './registry'
import { createDefaultFieldTypeRegistry, FieldTypeRegistry } from './fields'
import {
    StorageBackend,
    CreateSingleOptions,
    FindSingleOptions,
    FindManyOptions,
    CountOptions,
    UpdateManyOptions,
    UpdateSingleOptions,
    DeleteManyOptions,
    DeleteSingleOptions,
    CreateSingleResult,
    DeleteSingleResult,
    DeleteManyResult,
    UpdateSingleResult,
    UpdateManyResult,
    COLLECTION_OPERATIONS,
} from './types'
import { StorageMiddleware } from './types/middleware';

export { default as StorageRegistry } from './registry'

export interface StorageCollection {
    createObject(object, options?: CreateSingleOptions): Promise<CreateSingleResult>
    findOneObject<T>(query, options?: FindSingleOptions): Promise<T | null>
    findObject<T>(query, options?: FindSingleOptions): Promise<T | null>
    findObjects<T>(query, options?: FindManyOptions): Promise<Array<T>>
    findAllObjects<T>(query, options?: FindManyOptions): Promise<Array<T>>
    countObjects(query, options?: CountOptions): Promise<number>
    updateOneObject(object, updates, options?: UpdateSingleOptions): Promise<UpdateSingleResult>
    updateObjects(query, updates, options?: UpdateManyOptions): Promise<UpdateManyResult>
    deleteOneObject(object, options?: DeleteSingleOptions): Promise<DeleteSingleResult>
    deleteObjects(query, options?: DeleteManyOptions): Promise<DeleteManyResult>
}

export interface StorageCollectionMap {
    [name: string]: StorageCollection
}

const COLLECTION_OPERATION_ALIASES = {
    findOneObject: 'findObject',
    findAllObjects: 'findObjects',
    updateOneObject: 'updateObject',
    updateAllObject: 'updateObjects',
    deleteOneObject: 'deleteObject',
    deleteAllObjects: 'deleteObjects',
}

export default class StorageManager {
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

    finishInitialization() {
        return this.registry.finishInitialization()
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
