import StorageRegistry from "../registry"
import { StorageBackendFeatureSupport } from "./backend-features";
import { isRelationshipReference } from "./relationships";

export type CreateSingleOptions = DBNameOptions
export type CreateSingleResult = { object?: any }
export type CreateManyResult = { objects?: any[] }
export type CreateManyOptions = DBNameOptions & { withNestedObjects?: false }
export type FindSingleOptions = DBNameOptions & IgnoreCaseOptions & ReverseOptions & { fields?: string[] }
export type FindManyOptions = FindSingleOptions & PaginationOptions & SortingOptions
export type CountOptions = DBNameOptions & IgnoreCaseOptions
export type UpdateManyOptions = DBNameOptions
export type UpdateManyResult = any
export type UpdateSingleOptions = DBNameOptions
export type UpdateSingleResult = any
export type DeleteSingleOptions = DBNameOptions
export type DeleteSingleResult = any
export type DeleteManyOptions = DBNameOptions & { limit?: number }
export type DeleteManyResult = any
export type OperationBatch = Array<CreateObjectBatchOperation | UpdateObjectsBatchOperation | DeleteObjectsBatchOperation>
export type BatchOperationBase = { operation: string, placeholder?: string, replace?: { path: string, placeholder: string }[] }
export type CollectionBatchOperation = BatchOperationBase & { collection: string }
export type CreateObjectBatchOperation = CollectionBatchOperation & { operation: 'createObject', args: any }
export type UpdateObjectsBatchOperation = CollectionBatchOperation & { operation: 'updateObjects', where: any, updates: any }
export type DeleteObjectsBatchOperation = CollectionBatchOperation & { operation: 'deleteObjects', where: any }

export type IgnoreCaseOptions = { ignoreCase?: string[] }
export type ReverseOptions = { reverse?: boolean }
export type DBNameOptions = { database?: string }
export type PaginationOptions = { limit?: number, skip?: number }
export type SortingOptions = { order?: Array<[string, 'asc' | 'desc']> }

export const COLLECTION_OPERATIONS = new Set([
    'createObject',
    'findObject',
    'findObjects',
    'countObjects',
    'updateObject',
    'updateObjects',
    'deleteObject',
    'deleteObjects',
])
const CORE_OPERATIONS = COLLECTION_OPERATIONS
const PLUGGABLE_CORE_OPERATIONS = new Set([
    'alterSchema'
])
const IDENTIFIER_REGEX = /(?:([a-zA-Z]+)(\:))?(?:([a-zA-Z]+)(\.))?([a-zA-Z]+)/
export function _parseIdentifier(identifier: string) {
    const parts = IDENTIFIER_REGEX.exec(identifier)
    return {
        project: parts[1] || null,
        backend: parts[3] || null,
        operation: parts[5],
    }
}

export abstract class StorageBackend {
    readonly type: string = null
    readonly pluggableOperations: Set<string> = new Set()
    features: StorageBackendFeatureSupport = {}
    customFeatures: { [name: string]: true } = {}
    protected registry: StorageRegistry
    private operations = {}

    configure({ registry }: { registry: StorageRegistry }) {
        this.registry = registry

        // TODO: Compile this away in production builds
        for (const key of Object.keys(this.customFeatures)) {
            if (key.indexOf('.') === -1) {
                throw new Error(`Custom storage backend features must be namespaced with a '.', e.g. 'dexie.getVersionHistory'`)
            }
        }
    }

    use(plugin: StorageBackendPlugin<any>) {
        plugin.install(this)
    }

    async cleanup(): Promise<any> { }
    async migrate({ database }: { database?} = {}): Promise<any> { }

    abstract async createObject(collection: string, object, options?: CreateSingleOptions)

    abstract findObjects<T>(collection: string, query, options?: FindManyOptions): Promise<Array<T>>
    async findObject<T>(collection: string, query, options?: FindSingleOptions): Promise<T | null> {
        const objects = await this.findObjects<T>(collection, query, { ...options, limit: 1 })
        if (!objects.length) {
            return null
        }

        return objects[0]
    }

    /**
     * Note that this is a naive implementation that is not very space efficient.
     * It is recommended to override this implementation in storex backends with
     * DB-native queries.
     */
    async countObjects(collection: string, query, options?: CountOptions): Promise<number> {
        const objects = await this.findObjects(collection, query)

        return objects.length
    }

    abstract updateObjects(collection: string, query, updates, options?: UpdateManyOptions): Promise<UpdateManyResult>
    async updateObject(collection: string, object, updates, options?: UpdateSingleOptions): Promise<UpdateSingleResult> {
        const definition = this.registry.collections[collection]
        if (typeof definition.pkIndex === 'string') {
            return await this.updateObjects(collection, { [definition.pkIndex]: object[definition.pkIndex] }, updates, options)
        } else if (definition.pkIndex instanceof Array) {
            const where = {}
            for (let pkField of definition.pkIndex) {
                if (isRelationshipReference(pkField)) {
                    throw new Error('Updating single objects with relation pks is not supported yet')
                }
                where[pkField] = object[pkField]
            }
            return await this.updateObjects(collection, where, updates, options)
        } else {
            throw new Error('Updating single objects with relation pks is not supported yet')
        }
    }

    abstract deleteObjects(collection: string, query, options?: DeleteManyOptions): Promise<DeleteManyResult>
    async deleteObject(collection: string, object, options?: DeleteSingleOptions): Promise<DeleteSingleResult> {
        const definition = this.registry.collections[collection]
        if (typeof definition.pkIndex === 'string') {
            await this.deleteObjects(collection, { [definition.pkIndex]: object[definition.pkIndex] }, { ...(options || {}), limit: 1 })
        } else {
            throw new Error('Updating single objects with compound pks is not supported yet')
        }
    }

    async executeBatch(batch: OperationBatch): Promise<{ info }> {
        throw new Error('Not implemented')
    }

    supports(feature: string) {
        return CORE_OPERATIONS.has(feature) || !!this.features[feature] || !!this.customFeatures[feature]
    }

    async operation(operation: string, ...args) {
        const unsupported = () => {
            throw new Error(`Unsupported storage backend operation: ${operation}`)
        }

        if (!this.supports(operation)) {
            unsupported()
        }

        const parsedIdentifier = _parseIdentifier(operation)
        if (!parsedIdentifier.project && !parsedIdentifier.backend) {
            const method: Function = this[parsedIdentifier.operation]
            if (!method) {
                unsupported()
            }
            return method.apply(this, args)
        }

        const registeredOperation = this.operations[operation]
        if (!registeredOperation) {
            unsupported()
        }

        return registeredOperation(...args)
    }

    registerOperation(identifier: string, operation: (...args) => Promise<any>) {
        _validateOperationRegistration(identifier, this)

        this.operations[identifier] = operation
    }
}

export class StorageBackendPlugin<Backend> {
    public backend: Backend

    install(backend: Backend) {
        this.backend = backend as any as Backend
    }
}

export function _validateOperationRegistration(identifier, backend: StorageBackend) {
    const parsedIdentifier = _parseIdentifier(identifier)
    if (!parsedIdentifier.project) {
        if (!parsedIdentifier.backend && !PLUGGABLE_CORE_OPERATIONS.has(identifier)) {
            throw new Error(`Cannot register non-standard top-level operation '${identifier}'`)
        }
        if (parsedIdentifier.backend && !backend.pluggableOperations.has(parsedIdentifier.operation)) {
            throw new Error(`Cannot register non-standard backend-specific operation '${identifier}'`)
        }
    }

    return true
}