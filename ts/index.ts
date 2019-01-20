import * as fromPairs from 'lodash/fromPairs'
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
import OperationRegistry from './operations';

export { default as StorageRegistry } from './registry'

export interface StorageCollection {
    createObject(object, options? : CreateSingleOptions) : Promise<CreateSingleResult>
    findOneObject<T>(query, options?: FindSingleOptions) : Promise<T | null>
    findObjects<T>(query, options?: FindManyOptions) : Promise<Array<T>>
    countObjects(query, options?: CountOptions) : Promise<number>
    updateOneObject(object, updates, options?: UpdateSingleOptions): Promise<UpdateSingleResult>
    updateObjects(query, updates, options?: UpdateManyOptions): Promise<UpdateManyResult>
    deleteOneObject(object, options?: DeleteSingleOptions): Promise<DeleteSingleResult>
    deleteObjects(query, options?: DeleteManyOptions): Promise<DeleteManyResult>
}

export interface StorageCollectionMap {
    [name : string] : StorageCollection
}

export default class StorageManager {
    public registry : StorageRegistry
    public operationRegistry : OperationRegistry
    public backend : StorageBackend

    constructor({backend, fieldTypes} : {backend : StorageBackend, fieldTypes? : FieldTypeRegistry}) {
        this.registry = new StorageRegistry({fieldTypes: fieldTypes || createDefaultFieldTypeRegistry()})
        this.operationRegistry = this.operationRegistry
        this.backend = backend
        this.backend.configure({registry: this.registry, operationRegistry: this.operationRegistry})
    }

    finishInitialization() {
        return this.registry.finishInitialization()
    }

    collection(collectionName : string) : StorageCollection {
        const operation = operationName => (...args) => this.backend.operation(operationName, collectionName, ...args)
        return fromPairs(Array.from(COLLECTION_OPERATIONS).map(
            operationName => [operationName, operation(operationName)]
        ))
    }
}

export * from './types'
