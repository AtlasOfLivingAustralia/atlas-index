/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from "react";
import {cleanMustache, setClickEventByClassName, showLoginLogoutButtons} from "../util/utils";

interface FooterProps {
    isLoggedIn?: boolean,
    loginFn?: () => void,
    logoutFn?: () => void,
    footerUrl: string, // URL to fetch the external footer HTML
    containerClass?: string // container-fluid (default) or container
}

/**
 * Depends highly on what is in the external footer html. This component is responsible for setting up the footer.
 *
 * Footer must not contain script tags, as they will not be executed.
 *
 * Footer HTML functionality supported is:
 *   1. class="loginBtn" - button that triggers the login function
 *   2. class="loginBtn" - button that triggers the logout function
 *
 * Functionality common to footer and header
 *   1. class="{{containerClass}} - substituted with the Props containerClass value (default container-fluid)
 *   2. class="{{searchServer}}{{searchPath}}" - substituted with the Props searchBaseUrl value (ignored for footer)
 *   3. remaining {{ and }} are replaced in the mustache
 *   4. class="loginStatus" - div (or other) that is toggled with the presence of one of "signedIn" or "signedOut" depending on app state
 *
 * Refer to /static-server/static/common/footer.html for an example of the footer html
 *
 * @param isLoggedIn
 * @param loginFn
 * @param logoutFn
 * @param footerUrl component will not render if this is not set
 * @constructor
 */

function Footer({isLoggedIn, loginFn, logoutFn, footerUrl, containerClass}: FooterProps) {

    const [externalFooterHtml, setExternalFooterHtml] = useState('');

    const footerRef = useRef<HTMLDivElement>(null);

    // fetch the external footer html
    useEffect(() => {
        if (footerUrl) {
            fetch(footerUrl)
                .then((response) => response.text())
                .then((text) => setExternalFooterHtml(cleanMustache(text, containerClass || 'container-fluid')));
        }
    }, []);

    // setup the footer html after it is set
    useEffect(() => {
        if (!footerRef.current) {
            return;
        }

        if (externalFooterHtml && externalFooterHtml.length > 0) {
            // manually set the innerHTML to prevent React from reapplying after DOM modification
            footerRef.current.innerHTML = externalFooterHtml;

            // setup the html after it has been set, this will loop if DOM is not ready
            setupHtml();
        }
    }, [externalFooterHtml]);

    // show login/logout buttons when the login state changes
    useEffect(() => {
        if (footerRef?.current) {
            showLoginLogoutButtons(isLoggedIn, footerRef.current);
        }
    }, [isLoggedIn]);

    // setup the elements after being added to the DOM; show/hide login/logout buttons and add button listeners
    function setupHtml() {
        // loop until the footer content is available in the DOM
        if (!footerRef.current || footerRef.current.childElementCount === 0) {
            setTimeout(() => {
                setupHtml();
            }, 10);
            return;
        }

        showLoginLogoutButtons(isLoggedIn, footerRef.current); // may be unset, this is fine

        setClickEventByClassName("loginBtn", loginFn, footerRef.current);
        setClickEventByClassName("logoutBtn", logoutFn, footerRef.current);

        // remove href from loginBtn and logoutBtn
        const loginBtns = footerRef.current.getElementsByClassName("loginBtn");
        for (let i = 0; i < loginBtns.length; i++) {
            loginBtns[i].removeAttribute("href");
        }
        const logoutBtns = footerRef.current.getElementsByClassName("logoutBtn");
        for (let i = 0; i < logoutBtns.length; i++) {
            logoutBtns[i].removeAttribute("href");
        }
    }

    if (!footerUrl || !externalFooterHtml) {
        return null;
    }

    return <div ref={footerRef}></div>
}

export default Footer;
