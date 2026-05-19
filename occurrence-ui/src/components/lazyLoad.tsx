/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useRef } from 'react';

interface LazyLoadProps {
    active: boolean; // set true to load once
    children: React.ReactNode;
}

/**
 * Mounts children once on the first active. Hides children when not active.
 */
function LazyLoad({ active, children }: LazyLoadProps) {
    const activated = useRef(false);
    if (active) {
        activated.current = true;
    }

    if (!activated.current) {
        return null;
    }

    return <div style={{ display: active ? undefined : 'none' }}>{children}</div>;
}

export default LazyLoad;
