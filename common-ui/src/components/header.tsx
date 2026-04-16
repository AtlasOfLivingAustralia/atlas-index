/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from 'react';
import {
    cleanMustache,
    injectCommonJs,
    setClickEventByClassName,
    showLoginLogoutButtons
} from '../util/utils';

interface HeaderProps {
    isLoggedIn?: boolean,
    loginFn?: () => void,
    logoutFn?: () => void,
    headerUrl: string, // URL to fetch the external header HTML
    searchBaseUrl?: string, // Optional searchURL for mustache templates
    containerClass?: string, // container-fluid (default) or container
    jsUrl?: string // comma-delimited JS URLs to load after header HTML is ready
}

/**
 * Depends highly on what is in the external header html. This component is responsible for setting up the header.
 *
 * Header must not contain script tags, as they will not be executed.
 *
 * Header HTML functionality supported is:
 *   1. class="loginBtn" - button that triggers the login function
 *   2. class="loginBtn" - button that triggers the logout function
 *
 * Functionality common to footer and header
 *   1. class="{{containerClass}} - substituted with the Props containerClass value (default container-fluid)
 *   2. class="{{searchServer}}{{searchPath}}" - substituted with the Props searchBaseUrl value
 *   3. remaining {{ and }} are replaced in the mustache
 *   4. class="loginStatus" - div (or other) that is toggled with the presence of one of "signedIn" or "signedOut" depending on app state
 *
 * Refer to /static-server/static/common/banner.mustache for an example of the header template
 *
 * @param isLoggedIn
 * @param loginFn
 * @param logoutFn
 * @param headerUrl component will not render if this is not set
 * @param searchBaseUrl used by the autocomplete search
 * @param containerClass container-fluid (default) or container
 * @param jsUrl java script URLs to load, supports a comma delimited list
 * @constructor
 */
function Header({isLoggedIn, loginFn, logoutFn, headerUrl, searchBaseUrl, containerClass, jsUrl}: HeaderProps) {

    const [externalHeaderHtml, setExternalHeaderHtml] = useState('');

    const headerRef = useRef<HTMLDivElement>(null);

    // fetch the external header html
    useEffect(() => {
        if (headerUrl) {
            fetch(headerUrl)
                .then((response) => response.text())
                .then((text) => {
                    setExternalHeaderHtml(cleanMustache(text, containerClass || 'container-fluid', searchBaseUrl));
                });
        }
    }, []);

    // setup the html after the component is mounted
    useEffect(() => {
        if (!headerRef.current) {
            return;
        }

        if (externalHeaderHtml && externalHeaderHtml.length > 0) {
            // manually set the innerHTML to prevent React from reapplying after DOM modification
            headerRef.current.innerHTML = externalHeaderHtml;

            // setup the html after it has been set, this will loop if DOM is not ready
            setupHtml();
        }
    }, [externalHeaderHtml]);

    // listen for login status changes
    useEffect(() => {
        if (headerRef?.current) {
            showLoginLogoutButtons(isLoggedIn, headerRef.current);
        }
    }, [isLoggedIn]);

    // Integrate the dynamic html. It involves showing/hiding, setting up listeners, fetching some constants
    function setupHtml() {
        // loop until <header> is available
        if (!headerRef.current || headerRef.current.childElementCount === 0) {
            setTimeout(() => {
                setupHtml();
            }, 10);
            return;
        }

        // show/hide elements, set up listeners
        showLoginLogoutButtons(isLoggedIn, headerRef.current); // might be unset, this is fine

        setClickEventByClassName("loginBtn", loginFn, headerRef.current);
        setClickEventByClassName("logoutBtn", logoutFn, headerRef.current);

        // remove href from loginBtn and logoutBtn
        const loginBtns = headerRef.current.getElementsByClassName("loginBtn");
        for (let i = 0; i < loginBtns.length; i++) {
            loginBtns[i].removeAttribute("href");
        }
        const logoutBtns = headerRef.current.getElementsByClassName("logoutBtn");
        for (let i = 0; i < logoutBtns.length; i++) {
            logoutBtns[i].removeAttribute("href");
        }

        // load JS after header HTML is in the DOM so scripts like application.js can find #autocompleteHeader
        if (jsUrl) {
            injectCommonJs(jsUrl);
        }
    }

    if (!headerUrl || !externalHeaderHtml) {
        return null; // if no headerUrl is provided, do not render the header
    }

    return <div ref={headerRef}></div>
};

export default Header;
