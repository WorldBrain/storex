export interface StorageMiddleware {
    process({next, operation} : {next : {process: ({operation}) => any}, operation : any[]})
}
