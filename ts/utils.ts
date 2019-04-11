const pickBy = require('lodash/fp/pickBy')
import StorageRegistry from "./registry";
import { isChildOfRelationship, isConnectsRelationship, isRelationshipReference } from "./types";

const internalPluralize = require('pluralize')

export function pluralize(singular: string) {
    return internalPluralize(singular)
}

export type CreateObjectDissection = {objects: any[]}

export function dissectCreateObjectOperation(operationDefinition, registry : StorageRegistry, options : {generatePlaceholder? : () => string | number} = {}) : CreateObjectDissection {
    const objectsByPlaceholder = {}
    options.generatePlaceholder = options.generatePlaceholder || (() => {
        let placeholdersCreated = 0
        return () => ++placeholdersCreated
    })()

    const dissect = (collection : string, object, relations = {}, path = []) => {
        const collectionDefinition = registry.collections[collection]
        if (!collectionDefinition) {
            throw new Error(`Unknown collection: ${collection}`)
        }

        const lonelyObject = pickBy((value, key) => {
            return !collectionDefinition.reverseRelationshipsByAlias[key]
        }, object)

        const placeholder = options.generatePlaceholder()
        objectsByPlaceholder[placeholder] = lonelyObject
        const dissection = [
            {
                placeholder,
                collection,
                path,
                object: lonelyObject,
                relations,
            }
        ]

        for (const reverseRelationshipAlias in collectionDefinition.reverseRelationshipsByAlias) {
            let toCreate = object[reverseRelationshipAlias]
            if (!toCreate) {
                continue
            }
            
            const reverseRelationship = collectionDefinition.reverseRelationshipsByAlias[reverseRelationshipAlias]
            if (isChildOfRelationship(reverseRelationship)) {
                if (reverseRelationship.single) {
                    toCreate = [toCreate]
                }
                
                let childCount = 0
                for (const objectToCreate of toCreate) {
                    const childPath = [reverseRelationshipAlias] as Array<string | number>
                    if (!reverseRelationship.single) {
                        childPath.push(childCount)
                        childCount += 1
                    }

                    dissection.push(...dissect(
                        reverseRelationship.sourceCollection,
                        objectToCreate,
                        {[reverseRelationship.alias]: placeholder},
                        [...path, ...childPath]
                    ))
                }
            } else if (isConnectsRelationship(reverseRelationship)) {
                if (object[reverseRelationshipAlias]) {
                    throw new Error('Sorry, creating connects relationships through put is not supported yet  :(')
                }
            } else {
                throw new Error(`Sorry, but I have no idea what kind of relationship you're trying to create`)
            }
        }

        return dissection
    }

    return {objects: dissect(operationDefinition.collection, operationDefinition.args)}
}

export function convertCreateObjectDissectionToBatch(dissection : CreateObjectDissection) {
    const converted = []
    for (const step of dissection.objects) {
        converted.push({
            operation: 'createObject',
            collection: step.collection,
            placeholder: step.placeholder.toString(),
            args: step.object,
            replace: Object.entries(step.relations).map(([key, value]) => ({
                path: key,
                placeholder: value.toString()
            }))
        })
    }
    return converted
}

export function reconstructCreatedObjectFromBatchResult(args : {
    object, collection : string, storageRegistry : StorageRegistry,
    operationDissection : CreateObjectDissection, batchResultInfo
}) {
    for (const step of args.operationDissection.objects) {
        const collectionDefiniton = args.storageRegistry.collections[args.collection]
        const pkIndex = collectionDefiniton.pkIndex
        setIn(args.object, [...step.path, pkIndex], args.batchResultInfo[step.placeholder].object[pkIndex as string])
    }
}

export function setIn(obj, path : Array<string | number>, value) {
    for (const part of path.slice(0, -1)) {
        obj = obj[part]
    }
    obj[path.slice(-1)[0]] = value
}

export function getObjectPk(object, collection : string, registry : StorageRegistry) {
    const pkIndex = registry.collections[collection].pkIndex
    if (typeof pkIndex === 'string') {
        return object[pkIndex]
    }
    if (isRelationshipReference(pkIndex)) {
        throw new Error(`Getting object PKs of objects with relationships as PKs is not supported yet`)
    }

    const pk = []
    for (const indexField of pkIndex) {
        if (typeof indexField === 'string') {
            pk.push(object[indexField])
        } else {
            throw new Error(`getObject() called with relationship as pk, which is not supported yet.`)
        }
    }
    return pk
}

export function getObjectWithoutPk(object, collection : string, registry : StorageRegistry) {
    object = { ...object }

    const pkIndex = registry.collections[collection].pkIndex
    if (typeof pkIndex === 'string') {
        delete object[pkIndex]
        return object
    }
    if (isRelationshipReference(pkIndex)) {
        throw new Error(`Getting objects without PKs of objects with relationships as PKs is not supported yet`)
    }

    for (const indexField of pkIndex) {
        if (typeof indexField === 'string') {
            delete object[indexField]
        } else {
            throw new Error(`getObject() called with relationship as pk, which is not supported yet.`)
        }
    }
    return object
}

export function setObjectPk(object, pk, collection : string, registry : StorageRegistry) {
    const collectionDefinition = registry.collections[collection]
    if (!collectionDefinition) {
        throw new Error(`Could not find collection definition for '${collection}'`)
    }

    const pkIndex = collectionDefinition.pkIndex
    if (typeof pkIndex === 'string') {
        object[pkIndex] = pk
        return object
    }
    if (isRelationshipReference(pkIndex)) {
        throw new Error(`Setting object PKs of objects with relationships as PKs is not supported yet`)
    }

    let indexFieldIdx = 0
    for (const indexField of pkIndex) {
        if (typeof indexField === 'string') {
            object[indexField] = pk[indexFieldIdx++]
        } else {
            throw new Error(`setObjectPk() called with relationship as pk, which is not supported yet.`)
        }
    }

    return object
}
