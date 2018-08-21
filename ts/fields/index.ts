import { PrimitiveFieldType } from '../types'
import { RandomKeyField } from './random-key'
import { Field } from './types'

export class UrlField extends Field {
    primitiveType = <PrimitiveFieldType>'string'
}

export class FieldTypeRegistry {
    public fieldTypes : {[name : string] : {new () : Field}} = {}

    registerType(name : string, type : {new () : Field}) {
        this.fieldTypes[name] = type
        return this
    }

    registerTypes(fieldTypes : {[name : string] : {new () : Field}}) {
        Object.assign(this.fieldTypes, fieldTypes)
        return this
    }
}

export function createDefaultFieldTypeRegistry() {
    const registry = new FieldTypeRegistry()
    return registry.registerTypes({
        'random-key': RandomKeyField,
        'url': UrlField,
    })
}
