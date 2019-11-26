Storex allows you to implement custom operations on the back-end for application-specific functionality that you need to do on a lower level (directly execute an SQL statement for example), or include functionality you don't always want to include in your application (altering your schema structure for data migrations as an example.)

```typescript
import StorageManager from "@worldbrain/storex";
import { StorageBackendPlugin } from "@worldbrain/storex/lib/backend";
import { SequelizeStorageBackend } from "@worldbrain/storex-backend-sequelize";

class TestSequelizeStorageBackendPlugin extends StorageBackendPlugin<SequelizeStorageBackend> {
    install(backend : SequelizeStorageBackend) {
        super.install(backend)
        backend.registerOperation('myproject:sequelize.doSomething', async (foo, bar) => {
            backend.sequelize[backend.defaultDatabase] // Do something with the sequelize object
            return 'spam'
        })
    }
}

const backend = new SequelizeStorageBackend(...)
backend.use(new TestSequelizeStorageBackendPlugin())
const storageManager = new StorageManager({backend})
console.log(await storageManager.operation('myproject:sequelize.doSomething', 'foo, 'bar')) // 'spam'
```

Operation identifiers
=====================

The identifiers are namespaced as follows `<project>:<backend>.<operation>`. You can omit `<project>` and `<backend>`, but the rules are:
* If no `project` or `backend` is specified, you're registering a standardized operation like `alterSchema`, which is defined in an internal constant named `PLUGGABLE_CORE_OPERATIONS` in `@worldbrain/storex/ts/types/backend.ts`.
* If `backend` is defined, it should be an operation defined on `backend.pluggableOperations`.
* If you specify only a `project`, which might be the name of a plugin, or the application you're building on top of Storex, you can name your operation anything you want, unless you also specify `backend`, in which case it should be an operation defined on `backend.pluggableOperations`.
