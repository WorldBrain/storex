export interface RelationshipType {
}

export interface ChildOfRelationship extends RelationshipType {
    alias?: string
    sourceCollection?: string
    targetCollection?: string // = singleChildOf || childOf
    fieldName?: string
    reverseAlias?: string
    single?: boolean
}

export interface MultipleChildOfRelationship extends ChildOfRelationship {
    childOf: string
}
export interface SingleChildOfRelationship extends ChildOfRelationship {
    singleChildOf: string
}
export const isChildOfRelationship =
    (relationship) : relationship is ChildOfRelationship =>
        !!(<MultipleChildOfRelationship>relationship).childOf ||
        !!(<SingleChildOfRelationship>relationship).singleChildOf
export const getChildOfRelationshipTarget = (relationship : ChildOfRelationship) =>
    (<SingleChildOfRelationship>relationship).singleChildOf ||
    (<MultipleChildOfRelationship>relationship).childOf

export interface ConnectsRelationship extends RelationshipType {
    connects: [string, string]
    aliases?: [string, string]
    fieldNames?: [string, string]
    reverseAliases?: [string, string]
}
export const isConnectsRelationship =
    (relationship : Relationship) : relationship is ConnectsRelationship =>
        !!(<ConnectsRelationship>relationship).connects
export const isConnectsCollection = (relationships : Relationships) => {
    for (const relationship of relationships) {
        if (isConnectsRelationship(relationship)) {
            return true
        }
    }

    return false
}
export const getOtherCollectionOfConnectsRelationship =
    (relationship : ConnectsRelationship, thisCollection) =>
        relationship.connects[relationship.connects[0] == thisCollection ? 1 : 0]

export type Relationship = SingleChildOfRelationship | MultipleChildOfRelationship | ConnectsRelationship
export type Relationships = Relationship[]
export type RelationshipsByAlias = {[alias : string] : Relationship}
export type RelationshipReference = {relationship : string}
export const isRelationshipReference = (reference) : reference is RelationshipReference => !!(<RelationshipReference>reference).relationship
