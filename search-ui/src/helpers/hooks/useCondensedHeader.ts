/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from 'react';

// The name bar is display:none on short viewports, so its height is the "is it showing" check.
function coveredHeight(bar: HTMLElement, tabBar: HTMLElement) {
    const barHeight = bar.offsetHeight;
    return barHeight ? barHeight + tabBar.offsetHeight : 0;
}

/**
 * Helper hook for the desktop species name bar and tab bar. The name bar slides in once the tab bar reaches its pin line,
 * and in-page jumps land below both bars. `enabled` is true only while those bars are mounted.
 */
export default function useCondensedHeader(enabled: boolean, tab: string) {
    const barRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const [condensed, setCondensed] = useState(false);

    // Set by a tab click. Other tab changes (the Indigenous-names link) scroll somewhere else.
    const scrollAfterTab = useRef(false);

    useEffect(() => {
        const root = document.documentElement;
        const sentinel = sentinelRef.current;
        const bar = barRef.current;
        const tabBar = tabBarRef.current;

        if (!enabled || !sentinel || !bar || !tabBar) {
            setCondensed(false);
            root.style.scrollPaddingTop = '';
            return;
        }

        // Photos and a resized window change the header height without a scroll event.
        // The name bar is position:fixed, so a size change there does not resize the page.
        const sync = () => {
            const covered = coveredHeight(bar, tabBar);
            setCondensed(covered > 0 && sentinel.getBoundingClientRect().top <= bar.offsetHeight);

            const padding = covered ? `${covered}px` : '';
            if (root.style.scrollPaddingTop !== padding) root.style.scrollPaddingTop = padding;
        };
        sync();
        window.addEventListener('scroll', sync, {passive: true});

        const resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(bar);
        resizeObserver.observe(sentinel.parentElement!);

        return () => {
            window.removeEventListener('scroll', sync);
            resizeObserver.disconnect();
            root.style.scrollPaddingTop = '';
        };
    }, [enabled]);

    useEffect(() => {
        if (!scrollAfterTab.current) return;
        scrollAfterTab.current = false;

        const sentinel = sentinelRef.current;
        const bar = barRef.current;

        // A short viewport hides the name bar, so there is no pin line to stop above.
        if (!sentinel || !bar || !bar.offsetHeight) return;

        // One pixel above the pin line - landing on it would slide the name bar in and the tab bar down to meet it
        const top = sentinel.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 1;
        if (window.scrollY <= top) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({top, behavior: reduceMotion ? 'instant' : 'smooth'});
    }, [tab]);

    return {
        condensed,
        barRef,
        sentinelRef,
        tabBarRef,
        queueScrollToContent: () => {
            scrollAfterTab.current = true;
        },
    };
}