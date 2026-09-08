/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {useRuntimeLocale} from './i18nProvider';

/**
 * Language selector rendered INSIDE the ALA common header nav, styled as a Bootstrap navbar dropdown
 * exactly like the sibling items (e.g. "Help") rather than as a form <select>. The header is external
 * HTML injected at runtime from banner.mustache (served by the theme / static-server), so we do NOT
 * fork it: we portal an extra `.nav-item.dropdown` <li> into its `.navbar-nav` once it appears, and
 * keep observing so it survives a header re-injection. Bootstrap's own JS (already loaded for the
 * header) drives the dropdown via the standard `data-bs-toggle="dropdown"` delegated behaviour.
 *
 * Renders nothing for single-locale deployments (the ALA default), so the baseline header is unchanged.
 */
const HeaderLanguageSwitcher: React.FC = () => {
    const {locale, locales, setLocale} = useRuntimeLocale();
    const [mount, setMount] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (locales.length <= 1) return;

        let li: HTMLLIElement | null = null;

        const ensureMounted = () => {
            const nav = document.querySelector<HTMLElement>('.navbar-nav');
            if (!nav) return;
            if (li && nav.contains(li)) return; // already in place
            li = document.createElement('li');
            li.className = 'nav-item dropdown';
            nav.appendChild(li);
            setMount(li);
        };

        // The header loads asynchronously (fetch + innerHTML), so wait for `.navbar-nav` and re-add
        // our node if a later header injection wipes it.
        const observer = new MutationObserver(ensureMounted);
        observer.observe(document.body, {childList: true, subtree: true});
        ensureMounted();

        return () => {
            observer.disconnect();
            li?.remove();
            setMount(null);
        };
    }, [locales.length]);

    if (!mount) return null;

    const current = locales.find((l) => l.code === locale);

    return createPortal(
        <>
            <a
                className="nav-link dropdown-toggle"
                href="#"
                id="navbarDropdownLang"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                onClick={(e) => e.preventDefault()}
            >
                {current?.label ?? locale}
            </a>
            <ul className="dropdown-menu" aria-labelledby="navbarDropdownLang">
                {locales.map((l) => (
                    <li key={l.code}>
                        <a
                            className={`dropdown-item${l.code === locale ? ' active' : ''}`}
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setLocale(l.code);
                            }}
                        >
                            {l.label}
                        </a>
                    </li>
                ))}
            </ul>
        </>,
        mount
    );
};

export default HeaderLanguageSwitcher;
