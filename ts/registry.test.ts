import expect from 'expect'
import StorageRegistry from "./registry";
import { FieldTypeRegistry } from "./fields";
import { CollectionDefinitionMap } from './types';

const COLL_DEFS: CollectionDefinitionMap = {
    foo: [
        {
            version: new Date(2019, 1, 1),
            fields: {
                spam: { type: 'string' },
            },
        },
        {
            version: new Date(2019, 1, 2),
            fields: {
                spam: { type: 'string' },
                eggs: { type: 'string' },
            },
        },
    ],
    bar: [
        {
            version: new Date(2019, 1, 1),
            fields: {
                one: { type: 'string' },
            },
        },
        {
            version: new Date(2019, 1, 2),
            fields: {
                one: { type: 'string' },
                two: { type: 'string' },
            },
        },
    ],
}

async function createTestRegistry() {
    const registry = new StorageRegistry({fieldTypes: new FieldTypeRegistry})
    registry.registerCollections(COLL_DEFS)
    await registry.finishInitialization()
    return registry
}

describe('Storage registry', () => {
    it('should sort collections by version, taking the latest as the definitive version', async () => {
        const registryA = new StorageRegistry({
            fieldTypes: new FieldTypeRegistry(),
        })
        const registryB = new StorageRegistry({
            fieldTypes: new FieldTypeRegistry(),
        })

        registryA.registerCollections({
            foo: (COLL_DEFS.foo as Array<any>).reverse(),
            bar: (COLL_DEFS.bar as Array<any>).reverse(),
        })
        registryB.registerCollections({
            foo: COLL_DEFS.foo,
            bar: COLL_DEFS.bar,
        })

        for (const reg of [registryA, registryB]) {
            expect(reg.collections.foo).toEqual(
                expect.objectContaining({
                    version: COLL_DEFS.foo[1].version,
                    fields: expect.objectContaining({
                        spam: { type: 'string' },
                        eggs: { type: 'string' },
                    }),
                }),
            )

            expect(reg.collections.bar).toEqual(
                expect.objectContaining({
                    version: COLL_DEFS.bar[1].version,
                    fields: expect.objectContaining({
                        one: { type: 'string' },
                        two: { type: 'string' },
                    }),
                }),
            )
        }
    })

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
