/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {loadLicences, type Licence} from '../FormatLicence.ts';

export default function useLicences() {
    const [licences, setLicences] = useState<Licence[]>([]);

    useEffect(() => {
        let active = true;
        const fetchLicences = async () => {
            try {
                const data = await loadLicences(import.meta.env.VITE_APP_IMAGE_API_URL);
                if (active) setLicences(data);
            } catch {
                if (active) setLicences([]);
            }
        };
        fetchLicences();
        return () => { active = false; };
    }, []);

    return licences;
}