All CRUD operations under the hood use `StorageManager.operation()`, which then runs the operations through all configured middleware before calling `StorageBackend.operation()`. This is used by the device-to-device Sync functionality for example to log all database modifications to a separate log. `StorageMiddleware` usage looks like this:

```
import { StorageMiddleware } from '@worldbrain/storex/lib/types/middleware'

export class LogMiddleware implements StorageMiddleware {
    public log : Array<{ operation : any, result : any }> = []

    async process ({operation, next} : { operation : any[], next : { process : Function } }) {
        const result = await next.process({operation})
        this.log.append({ operation, result })
        return result
    }
}

// Setup your storageManager here
const logMiddleware = new LogMiddleware()
storageManager.setMiddleware([
    logMiddleware,
])
await storageManager.collection('user').createObject({ name: 'Joe' })
console.log(logMiddleware.log)
```
