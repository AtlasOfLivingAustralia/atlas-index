/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useRef, useState} from "react";
import {setClickEventByClassName, showLoginLogoutButtons} from "../util/utils";

interface FooterProps {
    isLoggedIn?: boolean,
    loginFn?: () => void,
    logoutFn?: () => void,
    footerUrl: string, // URL to fetch the external footer HTML
}

/**
 * Depends highly on what is in the external footer html. This component is responsible for setting up the footer.
 *
 * Footer must not contain script tags, as they will not be executed.
 *
 * Footer HTML functionality supported is:
 *   1. class="footer-login-button" - button that triggers the login function
 *   2. class="footer-logout-button" - button that triggers the logout function
 *   3. class="signedIn" - section that is visible when logged in (same as header.tsx)
 *   4. class="signedOut" - section that is visible when logged out (same as header.tsx)
 *
 * Refer to /static-server/static/common/footer.html for an example of the footer html
 *
 * @param isLoggedIn
 * @param loginFn
 * @param logoutFn
 * @param footerUrl component will not render if this is not set
 * @constructor
 */

function Footer({isLoggedIn, loginFn, logoutFn, footerUrl}: FooterProps) {

    const [externalFooterHtml, setExternalFooterHtml] = useState('');

    const footerRef = useRef<HTMLDivElement>(null);

    // fetch the external footer html
    useEffect(() => {
        if (footerUrl) {
            fetch(footerUrl)
                .then((response) => response.text())
                .then((text) => setExternalFooterHtml(text));
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
        showLoginLogoutButtons(isLoggedIn);
    }, [isLoggedIn]);

    // setup the elements after being added to the DOM; show/hide login/logout buttons and add button listeners
    function setupHtml() {
        // loop until <footer> is available
        const header = document.getElementsByTagName("footer");
        if (header.length == 0) {
            setTimeout(() => {
                setupHtml();
            }, 10);
            return;
        }

        showLoginLogoutButtons(isLoggedIn); // may be unset, this is fine

        setClickEventByClassName("footer-login-button", loginFn);
        setClickEventByClassName("footer-logout-button", logoutFn);
    }

    if (!footerUrl) {
        return null;
    }

    return <>
        {externalFooterHtml &&
            <div ref={footerRef}></div>
        }
    </>
}

export default Footer;
