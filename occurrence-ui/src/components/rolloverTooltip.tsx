/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useRef, useState } from 'react';
import { Overlay, Popover } from 'react-bootstrap';

function RolloverTooltip({ text, html, hideDelay, children }: { text?: string; html?: string; hideDelay?: number, children: React.ReactNode }) {
    const [show, setShow] = useState(false);
    const hoveredRef = useRef(false);
    const target = useRef(null);

    function handleMouseEnter() {
        if (!text && !html) return;
        hoveredRef.current = true;
        setShow(true);
    }

    function handleMouseLeave() {
        hoveredRef.current = false;
        if (hideDelay) {
            setTimeout(() => {
                if (!hoveredRef.current) setShow(false);
            }, hideDelay);
        } else {
            setShow(false);
        }
    }

    return (
        <>
            <span ref={target} style={{ cursor: 'pointer' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {children}
            </span>
            <Overlay target={target.current} show={show} placement='top'>
                {props => (
                    <Popover {...props}>
                        <Popover.Body>
                            <div style={{ fontSize: '14px' }}>
                                {text}
                                {html && <div dangerouslySetInnerHTML={{ __html: html || '' }}></div>}
                            </div>
                        </Popover.Body>
                    </Popover>
                )}
            </Overlay>
        </>
    );
}

export default RolloverTooltip;
