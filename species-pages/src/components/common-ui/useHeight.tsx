/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from "react";

// monitors the height of a ref element and returns it
export const useHeight = (ref: any) => {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (ref.current) {
            setHeight(ref.current.scrollHeight);
        }
    }, [ref]);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setHeight(entries[0].contentRect.height);
            }
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, [ref]);

    return height;
};
