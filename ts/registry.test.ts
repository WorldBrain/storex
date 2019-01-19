import * as expect from 'expect'
import StorageRegistry from "./registry";
import { FieldTypeRegistry } from "./fields";
import { version } from 'punycode';

async function createTestRegistry() {
    const registry = new StorageRegistry({fieldTypes: new FieldTypeRegistry})
    registry.registerCollections({
        foo: [
            {
                version: new Date(2019, 1, 1),
                fields: {
                    spam: {type: 'string'}
                }
            },
            {
                version: new Date(2019, 1, 2),
                fields: {
                    spam: {type: 'string'},
                    eggs: {type: 'string'},
                }
            },
        ],
        bar: [
            {
                version: new Date(2019, 1, 1),
                fields: {
                    one: {type: 'string'}
                }
            },
            {
                version: new Date(2019, 1, 2),
                fields: {
                    one: {type: 'string'},
                    two: {type: 'string'},
                }
            },
        ],
    })
    await registry.finishInitialization()
    return registry
}

describe('Storage registry', () => {
    it('should retrieve collections by version', async () => {
        const registry = await createTestRegistry()

        expect(registry.getCollectionsByVersion(new Date(2019, 1, 1))).toEqual({
            foo: expect.objectContaining({
                version: new Date(2019, 1, 1),
                fields: {
                    id: expect.objectContaining({
                        type: 'auto-pk'
                    }),
                    spam: {type: 'string'}
                }
            }),
            bar: expect.objectContaining({
                version: new Date(2019, 1, 1),
                fields: {
                    id: expect.objectContaining({
                        type: 'auto-pk'
                    }),
                    one: {type: 'string'}
                }
            })
        })

        expect(registry.getCollectionsByVersion(new Date(2019, 1, 2))).toEqual({
            foo: expect.objectContaining({
                version: new Date(2019, 1, 2),
                fields: {
                    id: expect.objectContaining({
                        type: 'auto-pk'
                    }),
                    spam: {type: 'string'},
                    eggs: {type: 'string'},
                }
            }),
            bar: expect.objectContaining({
                version: new Date(2019, 1, 2),
                fields: {
                    id: expect.objectContaining({
                        type: 'auto-pk'
                    }),
                    one: {type: 'string'},
                    two: {type: 'string'},
                }
            })
        })
    })

    it('should be able to generate the schema history', async () => {
        const registry = await createTestRegistry()
        expect(registry.getSchemaHistory()).toEqual([
            {
                version: new Date(2019, 1, 1),
                collections: registry.getCollectionsByVersion(new Date(2019, 1, 1))
            },
            {
                version: new Date(2019, 1, 2),
                collections: registry.getCollectionsByVersion(new Date(2019, 1, 2))
            },
        ])
    })
})
