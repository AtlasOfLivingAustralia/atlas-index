/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FontAwesomeIcon from '../common-ui/fontAwesomeIconLite.tsx';

interface InfoBoxProps {
    icon: any;
    title: string;
    content: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const InfoBox = ({icon, title, content, className, style}: InfoBoxProps) => (
    <>
        <div className={`d-flex align-items-start ${className ?? ''}`}
            style={{...style}}>
            <FontAwesomeIcon icon={icon} size={16} style={{ marginTop: "4px" }} />
            <span className="fw-bold" style={{ fontSize: 16, marginLeft: "10px" }}>{title}</span>
        </div>
        <div style={{fontSize: "16px", lineHeight: "20px", marginTop: "10px", marginBottom: "0px"}}>
            {content}
        </div>
    </>
);

export default InfoBox;
