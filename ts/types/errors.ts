export class StorexError extends Error {
    constructor(msg: string) {
        super(msg)
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
