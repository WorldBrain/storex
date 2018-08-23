import pickBy = require('lodash/fp/pickBy')
import { StorageRegistry } from '..'
import { isConnectsRelationship, isChildOfRelationship, getOtherCollectionOfConnectsRelationship } from '../types'

// Returns a super-putObject which automatically creates new objects for reverse relationships and handles custom field types
export function augmentCreateObject(rawCreateObject, {registry} : {registry : StorageRegistry}) {
    const augmentedCreateObject = async (collection : string, object, options?) => {
        const collectionDefinition = registry.collections[collection]
        
        // lonelyObject is shorter than objectWithoutRelationships
        // https://imgur.com/gallery/DaJpmyg
        const lonelyObject = pickBy((value, key) => {
            return !collectionDefinition.reverseRelationshipsByAlias[key]
        }, object)
        for (const relationshipAlias in collectionDefinition.relationshipsByAlias) {
            const relationship = collectionDefinition.relationshipsByAlias[relationshipAlias]
            if (!isChildOfRelationship(relationship)) {
                continue
            }

            const value = lonelyObject[relationshipAlias]
            if (value.id) {
                lonelyObject[relationshipAlias] = value.id
            }
        }

        await Promise.all(collectionDefinition.fieldsWithCustomType.map(
            async fieldName => {
                const fieldDef = collectionDefinition.fields[fieldName]
                lonelyObject[fieldName] = await fieldDef.fieldObject.prepareForStorage(lonelyObject[fieldName])
            }
        ))

        const {object: insertedObject} = await rawCreateObject(collection, lonelyObject, options)

        for (const reverseRelationshipAlias in collectionDefinition.reverseRelationshipsByAlias) {
            const reverseRelationship = collectionDefinition.reverseRelationshipsByAlias[reverseRelationshipAlias]
            if (isChildOfRelationship(reverseRelationship)) {
                let objectsToCreate = object[reverseRelationshipAlias]
                if (!objectsToCreate) {
                    continue
                }
                if (reverseRelationship.single) {
                    objectsToCreate = [objectsToCreate]
                }
                if (!reverseRelationship.single) {
                    insertedObject[reverseRelationshipAlias] = []
                }

                const otherCollection = reverseRelationship.sourceCollection
                for (const objectToCreate of objectsToCreate) {
                    objectToCreate[reverseRelationship.alias] = insertedObject[<string>collectionDefinition.pkIndex]
                    
                    const {object: insertedChild} = await augmentedCreateObject(otherCollection, objectToCreate)
                    if (reverseRelationship.single) {
                        insertedObject[reverseRelationshipAlias] = insertedChild
                    } else {
                        insertedObject[reverseRelationshipAlias].push(insertedChild)
                    }
                }
            } else if (isConnectsRelationship(reverseRelationship)) {
                if (object[reverseRelationshipAlias]) {
                    throw new Error('Sorry, creating connects relationships through put is not supported yet  :(')
                }
            }
        }

        return {object: insertedObject}
    }

    return augmentedCreateObject
}
