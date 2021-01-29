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
import * as joi from 'joi';


/**
 * Keeps sure to return a value as array.
 *
 * @param {T|T[]} val The input value.
 *
 * @return {T[]} The output value.
 */
export function asArray<T>(val: T | T[]): T[] {
    if (!Array.isArray(val)) {
        val = [val];
    }

    return val.filter(i => !_.isNil(i));
}

/**
 * Compares two values for sorting, by using a selector.
 *
 * @param {T} x The first value.
 * @param {T} y The second value.
 * @param {Function} selector The function, that selects the value to compare.
 *
 * @return {number} The soirt value.
 */
export function compareValuesBy<T, V>(x: T, y: T, selector: (i: T) => V): number {
    const VAL_X = selector(x);
    const VAL_Y = selector(y);

    if (VAL_X !== VAL_Y) {
        if (VAL_X < VAL_Y) {
            return -1;
        }

        if (VAL_X > VAL_Y) {
            return 1;
        }
    }

    return 0;
}

/**
 * Converts a value to a normalized string and checks if it is empty ('').
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is empty string ('') or not.
 */
export function isEmptyString(val: any): boolean {
    return '' === normalizeString(val);
}

/**
 * Checks if a value is a joi object or not.
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is joi object or not.
 */
export function isJoi<TObj extends joi.SchemaInternals = joi.AnySchema>(val: any): val is TObj {
    return joi.isSchema(val);
}

/**
 * Converts a value to a lower case and trimmed string.
 *
 * @param {any} val The input value.
 *
 * @return {string} The output value.
 */
export function normalizeString(val: any): string {
    return toStringSafe(val)
        .toLowerCase()
        .trim();
}

/**
 * Reads all data from a readable stream.
 *
 * @param {NodeJS.ReadStream} stream The stream to read.
 *
 * @return Promise<Buffer> The promise with the read data.
 */
export function readAll(stream: NodeJS.ReadStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let data: Buffer = Buffer.alloc(0);
        let completedInvoked = false;
        const COMPLETED = (err?: any) => {
            if (completedInvoked) {
                return;
            }
            completedInvoked = true;

            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        };

        try {
            stream.once("error", (err) => {
                COMPLETED(err);
            });

            stream.on("data", (chunk: Buffer) => {
                try {
                    if (data.length > 0) {
                        data = Buffer.concat([data, chunk]);
                    }
                } catch (e) {
                    COMPLETED(e);
                }
            });

            stream.once("end", () => {
                COMPLETED();
            });
        } catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Converts a value to a boolean, if needed.
 *
 * @param {any} val The input value.
 * @param {boolean} [defaultValue] The custom default value.
 *
 * @return {string} The output value.
 */
export function toBooleanSafe(val: any, defaultValue: boolean = false): boolean {
    if (_.isNil(val)) {
        return !!defaultValue;
    }

    return !!val;
}

/**
 * Converts a value to a string, if needed, that is not (null) and (undefined).
 *
 * @param {any} val The input value.
 *
 * @return {string} The output value.
 */
export function toStringSafe(val: any): string {
    if (_.isString(val)) {
        return val;
    }

    if (_.isNil(val)) {
        return '';
    }

    if (_.isFunction(val['toString'])) {
        return String(
            val.toString()
        );
    }

    return String(val);
}
