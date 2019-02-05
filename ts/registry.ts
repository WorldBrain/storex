import { EventEmitter } from 'events'
const fromPairs = require('lodash/fromPairs')
const sortBy = require('lodash/sortBy')
const pluralize = require('pluralize')
import {
    isConnectsRelationship,
    isChildOfRelationship,
    isRelationshipReference,
    getChildOfRelationshipTarget,
    SingleChildOfRelationship,
} from './types/relationships'
import { CollectionDefinitions, CollectionDefinition, CollectionDefinitionMap } from './types/collections'
import { IndexSourceField } from './types/indices'
import { FieldTypeRegistry } from './fields'

export interface RegistryCollections {
    [collName: string]: CollectionDefinition
}

export interface RegistryCollectionsVersionMap {
    [collVersion: number]: CollectionDefinition[]
}

export type SchemaHistory = SchemaHistoryEntry[]
export interface SchemaHistoryEntry {
    version: Date
    collections: RegistryCollections
}

export default class StorageRegistry extends EventEmitter {
    public collections: RegistryCollections = {}
    public _collectionsByVersion: RegistryCollectionsVersionMap = {}
    public _collectionVersionMap: { [name: string]: RegistryCollections } = {}
    public fieldTypes: FieldTypeRegistry

    constructor({ fieldTypes }: { fieldTypes: FieldTypeRegistry }) {
        super()

        this.fieldTypes = fieldTypes
    }

    registerCollection(name: string, defs: CollectionDefinitions) {
        if (!(defs instanceof Array)) {
            defs = [defs]
        }

        defs.sort(def => def.version.getTime()).forEach(def => {
            this.collections[name] = def
            def.name = name
            def.indices = def.indices || []

            this._preprocessFieldTypes(def)
            this._autoAssignCollectionPk(def)
            this._preprocessCollectionRelationships(name, def)
            this._preprocessCollectionIndices(name, def)

            const version = def.version.getTime()
            this._collectionsByVersion[version] =
                this._collectionsByVersion[version] || []
            this._collectionsByVersion[version].push(def)

            this._collectionVersionMap[version] = this._collectionVersionMap[version] || {}
            this._collectionVersionMap[version][name] = def
        })

        this.emit('registered-collection', { collection: this.collections[name] })
    }

    registerCollections(collections: CollectionDefinitionMap) {
        for (const [name, def] of Object.entries(collections)) {
            this.registerCollection(name, def)
        }
    }

    async finishInitialization() {
        this._connectReverseRelationships()
        return Promise.all(
            this.listeners('initialized').map(
                list => list.call(this),
            ),
        ).then(() => {})
    }

    get collectionVersionMap() {
        this._deprecationWarning('StorageRegistry.collectionVersionMap is deprecated, use StorageRegistry.getCollectionsByVersion() instead')
        return this._collectionVersionMap
    }

    getCollectionsByVersion(version: Date): RegistryCollections {
        return this._collectionVersionMap[version.getTime()]
    }

    get collectionsByVersion() {
        this._deprecationWarning('StorageRegistry.collectionsByVersion is deprecated, use StorageRegistry.getSchemaHistory() instead')
        return this._collectionsByVersion
    }

    getSchemaHistory(): SchemaHistory {
        const entries = Object.entries(this._collectionsByVersion)
        const sorted = sortBy(entries, ([version]) => parseInt(version))
        return sorted.map(([version, collectionsArray]) => {
            const collections = fromPairs(collectionsArray.map(
                collection => [collection.name, collection]
            ))
            return { version: new Date(parseInt(version)), collections }
        })
    }

    _preprocessFieldTypes(def: CollectionDefinition) {
        def.fieldsWithCustomType = []

        const fields = def.fields
        Object.entries(fields).forEach(([fieldName, fieldDef]) => {
            const FieldType = this.fieldTypes.fieldTypes[fieldDef.type]
            if (!FieldType) {
                return
            }

            fieldDef.fieldObject = new FieldType()
            def.fieldsWithCustomType.push(fieldName)
        })
    }

    /**
     * Handles mutating a collection's definition to flag all fields that are declared to be
     * indexable as indexed fields.
     */
    _preprocessCollectionIndices(collectionName: string, def: CollectionDefinition) {
        const flagField = (fieldName: string, indexDefIndex: number) => {
            if (!def.fields[fieldName]) {
                throw new Error(`Flagging field ${fieldName} of collection ${collectionName} as index, but field does not exist`)
            }
            def.fields[fieldName]._index = indexDefIndex
        }
        const flagIndexSourceField = (indexSource: IndexSourceField, indexDefIndex: number) => {
            if (isRelationshipReference(indexSource)) {
                const relationship = def.relationshipsByAlias[indexSource.relationship]
                if (isConnectsRelationship(relationship)) {
                    relationship.fieldNames.forEach(fieldName => flagField(fieldName, indexDefIndex))
                } else if (isChildOfRelationship(relationship)) {
                    flagField(relationship.fieldName, indexDefIndex)
                }
            } else {
                flagField(<string>indexSource, indexDefIndex)
            }
        }

        const indices = def.indices || []
        indices.forEach(({ field: indexSourceFields, pk: isPk }, indexDefIndex) => {
            // Compound indexes need to flag all specified fields
            if (indexSourceFields instanceof Array) {
                indexSourceFields.forEach(indexSource => { flagIndexSourceField(indexSource, indexDefIndex) })
            } else if (typeof indexSourceFields === 'string') {
                flagField(indexSourceFields, indexDefIndex)
            } else {
                throw Error('Got an invalid index for this collection: ' + collectionName)
            }
        })
    }

    _autoAssignCollectionPk(def: CollectionDefinition) {
        const indices = def.indices || []
        indices.forEach(({ field: indexSourceFields, pk: isPk }, indexDefIndex) => {
            if (isPk) {
                def.pkIndex = indexSourceFields
            }
        })
        if (!def.pkIndex) {
            indices.unshift({ field: 'id', pk: true })
            def.pkIndex = 'id'
        }
        if (typeof def.pkIndex === 'string' && !def.fields[def.pkIndex]) {
            def.fields[def.pkIndex] = { type: 'auto-pk' }
        }
    }

    /**
     * Creates the fields and indices for relationships
     */
    _preprocessCollectionRelationships(name: string, def: CollectionDefinition) {
        def.relationships = def.relationships || []
        def.relationshipsByAlias = {}
        def.reverseRelationshipsByAlias = {}
        for (const relationship of def.relationships) {
            if (isConnectsRelationship(relationship)) {
                relationship.aliases = relationship.aliases || relationship.connects
                relationship.fieldNames = relationship.fieldNames || [
                    `${relationship.aliases[0]}Rel`,
                    `${relationship.aliases[1]}Rel`
                ]

                relationship.reverseAliases = relationship.reverseAliases || [
                    pluralize(relationship.connects[1]),
                    pluralize(relationship.connects[0]),
                ]

                def.fields[relationship.fieldNames[0]] = { type: 'foreign-key' }
                def.fields[relationship.fieldNames[1]] = { type: 'foreign-key' }
                def.indices.push({ field: relationship.fieldNames })
            } else if (isChildOfRelationship(relationship)) {
                relationship.sourceCollection = name
                relationship.targetCollection = getChildOfRelationshipTarget(relationship)
                relationship.single = !!(<SingleChildOfRelationship>relationship).singleChildOf
                relationship.alias = relationship.alias || relationship.targetCollection
                def.relationshipsByAlias[relationship.alias] = relationship

                if (!relationship.reverseAlias) {
                    relationship.reverseAlias = relationship.single ? name : pluralize(name)
                }

                relationship.fieldName = relationship.fieldName || `${relationship.alias}Rel`
                def.fields[relationship.fieldName] = { type: 'foreign-key' }
                def.indices.push({ field: relationship.fieldName })
            } else {
                throw new Error("Invalid relationship detected: " + JSON.stringify(relationship))
            }
        }
    }

    _connectReverseRelationships() {
        Object.values(this.collections).forEach(sourceCollectionDef => {
            for (const relationship of sourceCollectionDef.relationships) {
                if (isConnectsRelationship(relationship)) {
                    this.collections[relationship.connects[0]].reverseRelationshipsByAlias[relationship.reverseAliases[0]] = relationship
                    this.collections[relationship.connects[1]].reverseRelationshipsByAlias[relationship.reverseAliases[1]] = relationship
                } else if (isChildOfRelationship(relationship)) {
                    const targetCollectionDef = this.collections[relationship.targetCollection]
                    targetCollectionDef.reverseRelationshipsByAlias[relationship.reverseAlias] = relationship
                }
            }
        })
    }

    _deprecationWarning(message) {
        console.warn(`DEPRECATED: ${message}`)
    }
}
