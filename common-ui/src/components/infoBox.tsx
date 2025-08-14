/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FontAwesomeIcon from './fontAwesomeIconLite.tsx';

interface InfoBoxProps {
    icon: any;
    title: string;
    content: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    size?: number;
    lineHeight?: number;
}

const InfoBox = ({icon, title, content, className, style, size = 16, lineHeight = 20}: InfoBoxProps) => (
    <>
        <div className={`d-flex align-items-start ${className ?? ''}`}
            style={{...style}}>
            <FontAwesomeIcon icon={icon} size={size} style={{ marginTop: "4px" }} />
            <span className="fw-bold" style={{ fontSize: size, marginLeft: "10px" }}>{title}</span>
        </div>
        <div style={{fontSize: size + "px", lineHeight: lineHeight + "px", marginTop: "10px", marginBottom: "0px"}}>
            {content}
        </div>
    </>
);

export default InfoBox;
