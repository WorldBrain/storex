import {CreateManyOptions, CreateManyResult, StorageRegistry} from "..";
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
} from './backend'

export interface StorageCollection {
    createObject(object, options?: CreateSingleOptions): Promise<CreateSingleResult>
    rawCreateObjects(objects, options: CreateManyOptions): Promise<CreateManyResult>
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

export default interface StorageManagerInterface {
    registry: StorageRegistry
    backend: StorageBackend

    finishInitialization() : Promise<void>
    collection(collectionName: string): StorageCollection
    operation(operationName : string, ...args) : Promise<any>
}