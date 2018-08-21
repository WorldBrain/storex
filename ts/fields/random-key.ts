import * as bluebird from 'bluebird'
import * as rawRandomBytes from 'randombytes'
const randomBytes = bluebird.promisify(rawRandomBytes)
import { PrimitiveFieldType } from '../types'
import { Field } from './types'

export class RandomKeyField extends Field {
    primitiveType = <PrimitiveFieldType>'string'
    length = 20

    async prepareForStorage(input) : Promise<string> {
        if (input) {
            return input
        }

        return await this.generateCode()
    }

    async generateCode() {
        const bytes = (await randomBytes(this.length));
        return bytes.toString('hex')
    }
}
