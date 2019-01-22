import { StorageBackend } from '../types'
import StorageRegistry from '../registry'
import { RandomKeyField } from '../fields/random-key'
import { augmentCreateObject } from './utils'

export class FakeRandomKeyField extends RandomKeyField {
    public counter = 1

    async generateCode() {
        return `no-so-random-key-${this.counter++}`
    }
}
export interface FakeStorageBackendConfig {
    idGenerator: (collection, object, options) => string
}
export class FakeStorageBackend extends StorageBackend {
    public createOperations: { object, id }[] = []

    constructor(public config: FakeStorageBackendConfig) {
        super()
    }

    configure({ registry }: { registry: StorageRegistry }) {
        super.configure({ registry })
        registry.fieldTypes.registerType('random-key', FakeRandomKeyField)

        this.createObject = augmentCreateObject(this.createObject.bind(this), { registry })
    }

    async createObject(collection: string, object, options) {
        const pkIndex = this.registry.collections[collection].pkIndex
        if (typeof pkIndex !== 'string') {
            throw new Error("Oops, we don't support compount pk's yet...")
        }

        const id = this.config.idGenerator(collection, object, options)
        this.createOperations.push({ object, id })
        return {
            pk: id,
            object: options.incObject ? { ...object, [pkIndex]: id } : undefined,
        }
    }

    async findObjects() {
        return []
    }

    async updateObjects() {
        return { count: 1 }
    }

    async deleteObjects() {
        return { count: 1 }
    }
}

