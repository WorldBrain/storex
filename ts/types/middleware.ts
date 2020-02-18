export interface StorageMiddleware {
    process(context: StorageMiddlewareContext)
}
export interface StorageMiddlewareContext {
    operation: any[]
    extraData: { [key: string]: any }
    next: { process: (context: { operation: any[], extraData?: { [key: string]: any } }) => any }
}
