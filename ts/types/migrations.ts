// TODO
export interface MigrationRunner {
    (): Promise<void>
    _seen?: boolean
}
