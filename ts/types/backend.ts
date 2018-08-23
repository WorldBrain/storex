import StorageRegistry from "../registry"

// export type PutSingleOptions = any
// export type PutSingleResult = {operation: 'create' | 'update', object?: any}
export type CreateSingleOptions = any
export type CreateSingleResult = {object?: any}
export type UpdateManyOptions = any
export type UpdateManyResult = any
export type UpdateSingleOptions = any
export type UpdateSingleResult = any
export type DeleteSingleOptions = any
export type DeleteSingleResult = any
export type DeleteManyOptions = {limit? : number}
export type DeleteManyResult = any

export class DeletionTooBroadError extends Error {
    public deletionTooBroad = true

    constructor(public collection : string, public query: any, public limit : number, public actual : number) {
        super(
            `You wanted to delete only ${limit} objects from the ${collection} collection, but you almost deleted ${actual}!` +
            `Phew, that was close, you owe me a beer! Oh, and you can find the query you tried to execute as the .query property of this error.`
        )
    }
}

export abstract class StorageBackend {
    protected registry : StorageRegistry

    configure({registry} : {registry : StorageRegistry}) {
        this.registry = registry
    }

    async cleanup() : Promise<any> {}
    async migrate({database} : {database?} = {}) : Promise<any> {}

    // async putObject(collection : string, object, options? : PutSingleOptions) : Promise<PutSingleResult> {
    //     const definition = this.registry.collections[collection]
    //     if (typeof definition.pkIndex === 'string') {
    //         if (object[definition.pkIndex]) {
    //             await this.updateObject(collection, {[definition.pkIndex]: object[definition.pkIndex]}, options)
    //             return {operation: 'update'}
    //         } else {
    //             return {operation: 'create', ...await this.createObject(collection, object, options)}
    //         }
    //     } else {
    //         throw new Error('Updating putObject() with compound pks is not supported yet')
    //     }
    // }

    abstract async createObject(collection : string, object, options? : CreateSingleOptions)
    
    abstract findObjects<T>(collection : string, query, options?) : Promise<Array<T>>
    async findObject<T>(collection : string, query, options?) : Promise<T | null> {
        const objects = await this.findObjects<T>(collection, query, {...options, limit: 1})
        if (!objects.length) {
            return null
        }

        return objects[0]
    }
    
    abstract updateObjects(collection : string, query, updates, options? : UpdateManyOptions) : Promise<UpdateManyResult>
    async updateObject(collection : string, object, updates, options? : UpdateSingleOptions) : Promise<UpdateSingleResult> {
        const definition = this.registry.collections[collection]
        if (typeof definition.pkIndex === 'string') {
            return await this.updateObjects(collection, {[definition.pkIndex]: object[definition.pkIndex]}, updates, options)
        } else {
            throw new Error('Updating single objects with compound pks is not supported yet')
        }
    }
    
    abstract deleteObjects(collection : string, query, options? : DeleteManyOptions) : Promise<DeleteManyResult>
    async deleteObject(collection : string, object, options? : DeleteSingleOptions) : Promise<DeleteSingleResult> {
        const definition = this.registry.collections[collection]
        if (typeof definition.pkIndex === 'string') {
            await this.deleteObjects(collection, {[definition.pkIndex]: object[definition.pkIndex]}, {...(options || {}), limit: 1})
        } else {
            throw new Error('Updating single objects with compound pks is not supported yet')
        }
    }
}
