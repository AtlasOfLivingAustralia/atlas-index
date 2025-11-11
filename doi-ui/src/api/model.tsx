/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Much of the DOI response is unstructured. Only define the fields we need.
interface DoiData {
    title: string;
    description: string;
    uuid: string;
    authorisedRoles?: string[];
    filename?: string;
    providerMetadata?: {
        title?: string;
    };
    dateCreated?: string;
    doi: string;
    displayTemplate?: boolean;
    applicationMetadata?: {
        recordCount: number;
        datasets: {
            name: string;
            licence: string;
            count: number;
        }[];
    };
}

export type { DoiData };
