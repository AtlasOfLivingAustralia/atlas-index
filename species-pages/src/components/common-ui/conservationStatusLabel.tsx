/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from "react";

export type Statuses = {
    [key: string]: {
        label: string;
        backgroundColour: string;
        textColour: string;
    };
};

const statuses : Statuses = {
    EX: {
        label: "Extinct",
        backgroundColour: "#000",
        textColour: "#FFC557",
    },
    EW: {
        label: "Extinct in the Wild",
        backgroundColour: "#000",
        textColour: "#FFF",
    },
    CR: {
        label: "Critically Endangered",
        backgroundColour: "#921D11",
        textColour: "#FFF",
    },
    EN: {
        label: "Endangered",
        backgroundColour: "#F26649",
        textColour: "#212121",
    },
    VU: {
        label: "Vulnerable",
        backgroundColour: "#FFC557",
        textColour: "#212121",
    },
    NT: {
        label: "Near Threatened",
        backgroundColour: "#38613D",
        textColour: "#FFF",
    },
    LC: {
        label: "Least Concern",
        backgroundColour: "#B7CD96",
        textColour: "#212121",
    },
};

export type ConservationStatusKey = keyof typeof statuses;

interface ConservationStatusProps {
    status: ConservationStatusKey;
    withLabel?: boolean;
}

function ConservationStatusLabel({
                                status,
                                withLabel,
                            }: ConservationStatusProps): React.ReactElement {
    const { label, backgroundColour, textColour } = statuses[status];

    return (
        <div className="d-flex align-items-start">
            <div
              style={{
                width: "2.5em",
                height: "2.5em",
                borderRadius: "50%",
                background: backgroundColour,
                color: textColour,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}
            >
              {status}
            </div>
            {withLabel && <span style={{ marginLeft: "5px", lineHeight: "2.5em" }}>{label}</span>}
        </div>
    );
}

export { ConservationStatusLabel, statuses };
