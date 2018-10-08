export class StorexError extends Error {
    constructor(msg: string) {
        super(msg)

        // Manually fixes TS issue that comes with extending from `Error`:
        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

export class DeletionTooBroadError extends StorexError {
    public deletionTooBroad = true

    constructor(public collection : string, public query: any, public limit : number, public actual : number) {
        super(
            `You wanted to delete only ${limit} objects from the ${collection} collection, but you almost deleted ${actual}!` +
            `Phew, that was close, you owe me a beer! Oh, and you can find the query you tried to execute as the .query property of this error.`
        )
    }
}

export class UnimplementedError extends StorexError {}
export class InvalidOptionsError extends StorexError {}
