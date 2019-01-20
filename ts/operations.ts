import * as objectHash from 'object-hash'

export type OperationIdentifier = string
export interface RegisteredOperation {
    type : string
    args : any[]
}
export type RegisteredOperationMap = {[id : string] : RegisteredOperation}

export class OperationRegistry {
    private _operations : RegisteredOperationMap = {}

    register(type : string, ...args) {
        const operation = { type, args }
        const id = this._generateId(operation)
        this._operations[id] = operation
        return id
    }

    getAll() : RegisteredOperationMap {
        return this._operations
    }

    _generateId(operation : RegisteredOperation) {
        return `operation:${objectHash(operation)}`
    }
}

export function substituteOperationPlaceholders(operation : RegisteredOperation, vars : {[name : string] : any}) {
    
}
