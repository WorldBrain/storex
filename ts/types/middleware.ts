export interface StorageMiddleware {
    process(context : StorageMiddlewareContext)
}
export interface StorageMiddlewareContext {
    operation : any[]
    next : { process: (context : { operation : any[] }) => any }
}
