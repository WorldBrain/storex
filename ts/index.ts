import StorageRegistry from './registry'
import { createDefaultFieldTypeRegistry, FieldTypeRegistry } from './fields'
export { default as StorageRegistry } from './registry'
import {
    StorageBackend,
    CreateSingleOptions,
    FindSingleOptions,
    FindManyOptions,
    SuggestOptions,
    CountOptions,
    UpdateManyOptions,
    UpdateSingleOptions,
    DeleteManyOptions,
    DeleteSingleOptions,
    CreateSingleResult,
    SuggestResult,
    DeleteSingleResult,
    DeleteManyResult,
    UpdateSingleResult,
    UpdateManyResult,
} from './types'

export interface StorageCollection {
    createObject(object, options? : CreateSingleOptions) : Promise<CreateSingleResult>
    findOneObject<T>(query, options?: FindSingleOptions) : Promise<T | null>
    findObjects<T>(query, options?: FindManyOptions) : Promise<Array<T>>
    countObjects(query, options?: CountOptions) : Promise<number>
    suggestObjects<S, P = any>(query, options?: SuggestOptions) : Promise<SuggestResult<S, P>>
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
    public backend : StorageBackend

    constructor({backend, fieldTypes} : {backend : StorageBackend, fieldTypes? : FieldTypeRegistry}) {
        this.registry = new StorageRegistry({fieldTypes: fieldTypes || createDefaultFieldTypeRegistry()})
        this.backend = backend
        this.backend.configure({registry: this.registry})
    }

    finishInitialization() {
        this.registry._finishInitialization()
    }

    collection(name : string) : StorageCollection {
        return {
            createObject: (object) => this.backend.createObject(name, object),
            findOneObject: (query, options?) => this.backend.findObject(name, query, options),
            findObjects: (query, options?) => this.backend.findObjects(name, query, options),
            countObjects: (query, options?) => this.backend.countObjects(name, query, options),
            suggestObjects: (query, options?) => this.backend.suggestObjects(name, query, options),
            updateOneObject: (object, options?) => this.backend.updateObject(name, object, options),
            updateObjects: (query, options?) => this.backend.updateObjects(name, query, options),
            deleteOneObject: (object, options?) => this.backend.deleteObject(name, object, options),
            deleteObjects: (query, options?) => this.backend.deleteObjects(name, query, options),
        }
    }
}
