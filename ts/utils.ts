const pickBy = require('lodash/fp/pickBy')
import StorageRegistry from "./registry";
import { isChildOfRelationship, isConnectsRelationship } from "./types";

const internalPluralize = require('pluralize')

export function pluralize(singular: string) {
    return internalPluralize(singular)
}

export type CreateObjectDissection = {objects: any[]}

export function dissectCreateObjectOperation(operationDefinition, registry : StorageRegistry) : CreateObjectDissection {
    const objectsByPlaceholder = {}
    let placeholdersCreated = 0

    const dissect = (collection : string, object, relations = {}, path = []) => {
        const collectionDefinition = registry.collections[collection]
        if (!collectionDefinition) {
            throw new Error(`Unknown collection: ${collection}`)
        }

        const lonelyObject = pickBy((value, key) => {
            return !collectionDefinition.reverseRelationshipsByAlias[key]
        }, object)

        const placeholder = ++placeholdersCreated
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
                        {[collection]: placeholder},
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
    let placeholder = 0
    const converted = []
    for (const step of dissection.objects) {
        converted.push({
            operation: 'createObject',
            collection: step.collection,
            placeholder: (++placeholder).toString(),
            args: step.object,
            replace: Object.entries(step.relations).map(([key, value]) => ({
                path: key,
                placeholder: value.toString()
            }))
        })
    }
    return converted
}

export function setIn(obj, path : Array<string | number>, value) {
    for (const part of path.slice(0, -1)) {
        obj = obj[part]
    }
    obj[path.slice(-1)[0]] = value
}
