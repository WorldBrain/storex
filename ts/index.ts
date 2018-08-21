import StorageRegistry from './registry'
import { StorageBackend, CreateSingleResult } from './types'
import { createDefaultFieldTypeRegistry, FieldTypeRegistry } from './fields'
export { default as StorageRegistry } from './registry'

export interface StorageCollection {
    // putObject(object) : Promise<PutSingleResult>
    createObject(object) : Promise<CreateSingleResult>
    findOneObject<T>(query, options?) : Promise<T | null>
    findObjects<T>(query, options?) : Promise<Array<T>>
    updateOneObject(object, updates, options?)
    updateObjects(query, updates, options?)
    deleteOneObject(object, options?)
    deleteObjects(query, options?)
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
            // putObject: (object) => this.backend.putObject(name, object),
            createObject: (object) => this.backend.createObject(name, object),
            findOneObject: (query, options?) => this.backend.findObject(name, query, options),
            findObjects: (query, options?) => this.backend.findObjects(name, query, options),
            updateOneObject: (object, options?) => this.backend.updateObject(name, object, options),
            updateObjects: (query, options?) => this.backend.updateObjects(name, query, options),
            deleteOneObject: (object, options?) => this.backend.deleteObject(name, object, options),
            deleteObjects: (query, options?) => this.backend.deleteObjects(name, query, options),
        }
    }
}
