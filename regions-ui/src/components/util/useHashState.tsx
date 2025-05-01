/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useState, useEffect, useCallback} from 'react';

/**
 * Hook to manage a state value in the URL hash. e.g. #tab=first&group=myGroup
 *
 * @param key name of hash property, e.g. 'tab'
 * @param defaultValue default value if hash property is not set
 * @param enableListener if true, listen for hash changes and update state
 */
function useHashState<T>(key: string, defaultValue: T, enableListener: boolean = false): [T, (newValue: T) => void] {
    const getHashValue = useCallback(() => {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const value = hashParams.get(key) || defaultValue;
        if (value === null || value === undefined) {
            return defaultValue;
        }
        try {
            // @ts-ignore because exceptions are handled
            return JSON.parse(value) as T;
        } catch {
            try {
                return value as T;
            } catch {
                return defaultValue;
            }
        }
    }, [key, defaultValue]);

    const [value, setValue] = useState<T>(getHashValue);

    useEffect(() => {
        if (!enableListener) {
            return;
        }

        const handleHashChange = () => {
            setValue(getHashValue());
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [getHashValue]);

    const setHashValue = (newValue: T | ((prevState: T) => T)) => {
        const valueToSet = typeof newValue === 'function' ? (newValue as (prevState: T) => T)(value) : newValue;

        if (valueToSet === value) {
            return;
        }

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (valueToSet !== undefined && valueToSet !== null && valueToSet !== defaultValue) {
            if (typeof valueToSet === 'string') { // remove double quotes from string
                hashParams.set(key, valueToSet);
            } else {
                hashParams.set(key, JSON.stringify(valueToSet));
            }
        } else {
            hashParams.delete(key);
        }
        window.location.hash = `#${hashParams.toString()}`;
        setValue(valueToSet);
    };

    return [value, setHashValue];
}

export default useHashState;
