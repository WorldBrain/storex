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

    const dissect = (collection : string, object, relations = {}) => {
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
                
                for (const objectToCreate of toCreate) {
                    dissection.push(...dissect(reverseRelationship.sourceCollection, objectToCreate, {[collection]: placeholder}))
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
