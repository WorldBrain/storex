import { Field } from '../fields'
import { FieldType } from "./fields"
import { IndexDefinition, IndexSourceFields } from './indices'
import { Relationships, RelationshipsByAlias } from './relationships'
import { MigrationRunner } from './migrations'

export type CollectionDefinitionMap = {[name : string] : CollectionDefinitions}

export type CollectionDefinitions =
    | CollectionDefinition[]
    | CollectionDefinition

export interface CollectionFields {
    [fieldName: string]: CollectionField
}

export interface CollectionField {
    type: FieldType
    optional?: boolean
    fieldObject?: Field
    _index?: number
}

export interface CollectionDefinition {
    version: Date
    fields: CollectionFields
    indices: IndexDefinition[]
    pkIndex?: IndexSourceFields
    relationships?: Relationships
    relationshipsByAlias?: RelationshipsByAlias
    reverseRelationshipsByAlias?: RelationshipsByAlias
    fieldsWithCustomType?: string[]
    migrate?: MigrationRunner
    name?: string
    watch?: boolean // should we include this in the 'changing' event? defaults to true
    backup?: boolean
}
