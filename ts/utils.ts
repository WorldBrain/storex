const internalPluralize = require('pluralize')

export function pluralize(singular: string) {
    return internalPluralize(singular)
}
