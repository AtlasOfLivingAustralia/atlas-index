/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useRef, useState } from 'react';
import { Overlay, Popover } from 'react-bootstrap';

function CopyTooltip({text, children}: { text: string, children: React.ReactNode }) {
    const [show, setShow] = useState(false);
    const target = useRef(null);

    return (
        <>
            <span ref={target} style={{ cursor: 'pointer' }} onClick={() => {
                setShow(true);
                setTimeout(() => {setShow(false);}, 1000);
            }}>
                {children}
            </span>
            <Overlay target={target.current} show={show} placement='top'>
                {props => (
                    <Popover {...props} style={{ ...props.style }}>
                        <Popover.Body>
                            <div>{text}</div>
                        </Popover.Body>
                    </Popover>
                )}
            </Overlay>
        </>
    );
}

export default CopyTooltip;
