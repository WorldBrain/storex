import { PrimitiveFieldType } from "../types"

export abstract class Field {
    abstract primitiveType : PrimitiveFieldType

    async prepareForStorage(input) {
        return input
    }

    async prepareFromStorage(stored) {
        return stored
    }
}
