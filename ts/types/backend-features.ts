export interface StorageBackendFeatureSupport {
  count? : boolean
  ignoreCase? : boolean
  fullTextSearch? : boolean
  createWithRelationships? : boolean
  updateWithRelationships? : boolean
  relationshipFetching? : boolean
  crossRelationshipQueries? : boolean
}
