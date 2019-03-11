export interface StorageBackendFeatureSupport {
  transaction? : boolean
  count? : boolean
  ignoreCase? : boolean
  fullTextSearch? : boolean
  createWithRelationships? : boolean
  updateWithRelationships? : boolean
  relationshipFetching? : boolean
  crossRelationshipQueries? : boolean
  executeBatch? : boolean
  batchCreates? : boolean
  resultLimiting? : boolean
  singleFieldSorting? : boolean
  multiFieldSorting? : boolean
  sortWithIndependentRangeFilter? : boolean
}
