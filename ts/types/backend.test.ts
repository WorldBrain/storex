import * as expect from 'expect'
import { StorageBackend, StorageBackendPlugin, _parseIdentifier, _validateOperationRegistration } from "./backend";

class DummyStorageBackend extends StorageBackend {
    readonly type = 'dummy'
    dummmy = 'test'

    async createObject() {}
    async findObjects() { return [] }
    async updateObjects() {}
    async deleteObjects() {}
}

describe('Backend base class', () => {
    it('should register plugins correctly', async () => {
        const operationCalls = []
        class DummyStorageBackendPlugin extends StorageBackendPlugin<DummyStorageBackend> {
            install(backend : DummyStorageBackend) {
                super.install(backend)
                backend.registerOperation('myproject:dummy.doSomething', async (...args) => {
                    operationCalls.push({args})
                    return this.backend.dummmy
                })
            }
        }

        const backend = new DummyStorageBackend()
        backend.use(new DummyStorageBackendPlugin())
        expect(await backend.operation('myproject:dummy.doSomething', 'foo', 'bar')).toEqual('test')
        expect(operationCalls).toEqual([{args: ['foo', 'bar']}])
    })

    it('should allow registering standard top-level operations', async () => {
        expect(_validateOperationRegistration(
            'alterSchema', {type: 'dummy', pluggableOperations: new Set()} as StorageBackend
        )).toEqual(true)
    })

    it('should prevent registering unknown top-level operations', async () => {
        expect(() => _validateOperationRegistration(
            'bla', {type: 'dummy', pluggableOperations: new Set()} as StorageBackend
        )).toThrow(`Cannot register non-standard top-level operation 'bla'`)
    })

    it('should allow registering well-known backend-specific operations', async () => {
        expect(_validateOperationRegistration(
            'dummy.bla', {type: 'dummy', pluggableOperations: new Set(['bla'])} as StorageBackend
        )).toEqual(true)
    })

    it('should prevent registering unknown backend-specific operations', async () => {
        expect(() => _validateOperationRegistration(
            'dummy.bla', {type: 'dummy', pluggableOperations: new Set(['foo'])} as StorageBackend
        )).toThrow(`Cannot register non-standard backend-specific operation 'dummy.bla'`)
    })
})

describe('Operation identifier parsing', () => {
    it('should parse a simple name', () => {
        expect(_parseIdentifier('operation')).toEqual({
            project: null,
            backend: null,
            operation: 'operation'
        })
    })

    it('should parse a name with a backend', () => {
        expect(_parseIdentifier('backend.operation')).toEqual({
            project: null,
            backend: 'backend',
            operation: 'operation'
        })
    })

    it('should parse a name with a project and a backend', () => {
        expect(_parseIdentifier('project:backend.operation')).toEqual({
            project: 'project',
            backend: 'backend',
            operation: 'operation'
        })
    })

    it('should parse a name with a project', () => {
        expect(_parseIdentifier('project:operation')).toEqual({
            project: 'project',
            backend: null,
            operation: 'operation'
        })
    })
})