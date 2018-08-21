import { RelationshipReference } from "./relationships"

export type IndexSourceField = string | RelationshipReference
export type IndexSourceFields = IndexSourceField | IndexSourceField[]

export interface IndexDefinition {
    /**
     * Points to a corresponding field name defined in the `fields` part of the collection definition.
     * In the case of a compound index, this should be a pair of fields expressed as an `Array`.
     */
    field: IndexSourceFields
    /**
     * Denotes whether or not this index should be a primary key. There should only be one index
     * with this flag set.
     */
    pk?: boolean
    /**
     * Denotes the index being enforced as unique.
     */
    unique?: boolean
    /**
     * Denotes the primary key index will be auto-incremented.
     * Only used if `pk` flag also set. Implies `unique` flag set.
     */
    autoInc?: boolean
    /**
     * Sets a custom name for the corresponding index created to afford full-text search.
     * Note that this will only be used if the corresponding field definition in `fields` is
     * of `type` `'text'`.
     */
    fullTextIndexName?: string
}
