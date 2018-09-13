export interface StorageBackendFeatureSupport {
  count? : boolean
  fullTextSearch? : boolean
  createWithRelationships? : boolean
  updateWithRelationships? : boolean
  relationshipFetching? : boolean
  crossRelationshipQueries? : boolean
}
