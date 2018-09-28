export type PrimitiveFieldType =
    | 'auto-pk'
    | 'foreign-key'
    | 'text'
    | 'json'
    | 'datetime'
    | 'timestamp'
    | 'string'
    | 'boolean'
    | 'float'
    | 'int'
    | 'blob'
    | 'binary'

export type FieldType =
    | PrimitiveFieldType
    | 'random-key'
    | 'url'
    | 'media'
