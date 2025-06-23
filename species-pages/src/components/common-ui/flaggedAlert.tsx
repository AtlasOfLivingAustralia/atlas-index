/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FlagIcon from "./icons/flagIcon.tsx";

interface InfoBoxProps {
    content: React.ReactNode;
    style?: React.CSSProperties;
}

const InfoBox = ({content, style}: InfoBoxProps) => (
    <div className="d-inline-flex align-items-start" style={{backgroundColor: "#FFC557", padding: "10px", borderRadius: "5px", ...style}}>
        <FlagIcon />
        <div style={{marginLeft: "10px", marginRight: "10px"}}>
            {content}
        </div>
    </div>
);

export default InfoBox;
