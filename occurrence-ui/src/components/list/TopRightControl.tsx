/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createControlComponent } from '@react-leaflet/core';

function createLeafletControl(opts?: L.ControlOptions & { className?: string }) {
    const Control = L.Control.extend({
        onAdd() {
            const div = L.DomUtil.create('div', opts?.className || 'leaflet-control custom-layer-controls');
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            return div;
        },
    });
    return new Control({ position: 'topright', ...opts });
}

const ControlShell = createControlComponent<L.Control, L.ControlOptions & { className?: string }>(createLeafletControl);

/**
 * TopRightControl mounts a Leaflet control (via ControlShell) and
 * then portals `children` into the control's DOM container.
 */
function TopRightControl({
                                    children,
                                    className = 'leaflet-control custom-layer-controls',
                                    position = 'topright',
                                }: {
    children: React.ReactNode;
    className?: string;
    position?: L.ControlPosition;
}) {
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    useEffect(() => {
        // Try to get the container immediately if already mounted
        let el = document.querySelector(`.${className.split(' ').join('.')}`) as HTMLElement | null;
        if (el) {
            setContainer(el);
            return;
        }

        // Otherwise observe the map for the control being inserted
        const root = document.querySelector('.leaflet-control-container');
        if (!root) return;

        observerRef.current = new MutationObserver(() => {
            el = document.querySelector(`.${className.split(' ').join('.')}`) as HTMLElement | null;
            if (el) {
                setContainer(el);
                observerRef.current?.disconnect();
                observerRef.current = null;
            }
        });
        observerRef.current.observe(root, { childList: true, subtree: true });

        return () => {
            observerRef.current?.disconnect();
            observerRef.current = null;
        };
    }, [className]);

    return (
        <>
            <ControlShell position={position} className={className} />
            {container ? createPortal(children, container) : null}
        </>
    );
}

export default TopRightControl;
