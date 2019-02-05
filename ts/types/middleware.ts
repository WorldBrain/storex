import StorageManagerInterface from "./manager"

export interface StorageMiddleware {
    setup? : ({storageManager} : {storageManager : StorageManagerInterface}) => void
    process({next, operation} : {next : {process: ({operation}) => any}, operation : any[]})
}
