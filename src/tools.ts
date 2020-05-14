/**
 * This file is part of the @egodigital/express-controllers distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * @egodigital/express-controllers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * @egodigital/express-controllers is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as isStream from 'is-stream';
import * as moment from 'moment';
import { readAll } from './utils';

interface IHandledSerializedValues {
    serialized: any;
    value: any;
}

/**
 * Serializes a value for use as JSON response.
 *
 * @param {any} val The value to serialize.
 *
 * @returns {Promise<any>} The promise with the serialized value.
 */
export function serializeForJSON(val: any): Promise<any> {
    return serializeForJSONInner(
        val, []
    );
}

async function serializeForJSONInner(
    val: any, handledValues: IHandledSerializedValues[],
    depth: number = 0
): Promise<any> {
    if (depth > 63) {
        return val;  // too deep
    }

    // null or undefined?
    if (_.isNil(val)) {
        return val;
    }

    // primitive data type?
    if (
        _.isBoolean(val) ||
        _.isNumber(val) ||
        _.isString(val)
    ) {
        return val;
    }

    if (_.isDate(val)) {
        let m = moment(val);
        if (!m.isUTC()) {
            m = m.utc();
        }

        return m.toISOString();
    }

    if (moment.isMoment(val)) {
        let m = val;
        if (!m.isUTC()) {
            m = m.utc();
        }

        return m.toISOString();
    }

    if (Buffer.isBuffer(val)) {
        return val.toString('base64');
    }

    if (isStream.readable(val)) {
        return (
            await readAll(val as NodeJS.ReadStream)
        ).toString('base64');
    }

    // function? => ge result value?
    if (_.isFunction(val)) {
        return await serializeForJSONInner(
            await Promise.resolve(
                val()
            ),
            handledValues,
            depth + 1
        );
    }

    const FIND_HANDLED_INSTANCE = async (v: any): Promise<IHandledSerializedValues> => {
        if (_.isNil(v)) {
            return {
                serialized: v,
                value: v
            };
        }

        for (const HV of handledValues) {
            if (HV.value === v) {
                return HV;  // found
            }
        }

        // new
        const NEW_VALUE: IHandledSerializedValues = {
            serialized: await serializeForJSONInner(v, handledValues),
            value: v
        };
        handledValues.push(NEW_VALUE);

        return NEW_VALUE;
    };

    // array?
    if (_.isArray(val)) {
        const NEW_ARRAY: any[] = [];
        for (const ITEM of val) {
            NEW_ARRAY.push(
                (await FIND_HANDLED_INSTANCE(ITEM)).serialized
            );
        }

        return NEW_ARRAY;
    }

    // iterator => array ?
    if ('function' === typeof val[Symbol.iterator]) {
        const ARR: any[] = [];
        for (const ITEM of val) {
            ARR.push(
                (await FIND_HANDLED_INSTANCE(ITEM)).serialized
            );
        }

        return ARR;
    }

    // handle as plain object
    const NEW_OBJECT: any = {};
    for (const PROP in val) {
        const VALUE = val[PROP];
        if (_.isFunction(VALUE)) {
            continue;  // at that point => ignore
        }

        NEW_OBJECT[PROP] = (await FIND_HANDLED_INSTANCE(VALUE)).serialized;
    }

    return NEW_OBJECT;
}