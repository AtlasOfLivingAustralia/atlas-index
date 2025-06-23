/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';

interface FormatNameProps {
    name: string;
    rankId: number;
}

const FormatName: React.FC<FormatNameProps> = ({
    name, rankId
}: FormatNameProps) => {
    return (
        <>
            {rankId && rankId <= 8000 && rankId >= 6000 ? (
                <span style={{ fontStyle: "italic" }}>{name}</span>
            ) : (
                <span>{name}</span>
            )}
        </>
    );
}

export default FormatName;
