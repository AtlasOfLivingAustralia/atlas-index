import {useEffect, useState} from "react";
import {setClickEventByClassName, showLoginLogoutButtons} from "./utils.tsx";

interface FooterProps {
    isLoggedIn?: boolean,
    loginFn?: () => void,
    logoutFn?: () => void
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
 * @constructor
 */

function Footer({isLoggedIn, loginFn, logoutFn}: FooterProps) {

    const [externalFooterHtml, setExternalFooterHtml] = useState('');

    // fetch the external footer html
    useEffect(() => {
        fetch(import.meta.env.VITE_COMMON_FOOTER_HTML)
            .then((response) => response.text())
            .then((text) => setExternalFooterHtml(text));
    }, []);

    // setup the footer html after it is set
    useEffect(() => {
        setupHtml();
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

    return <>
        {externalFooterHtml &&
            <div dangerouslySetInnerHTML={{__html: externalFooterHtml}}></div>
        }
    </>
}

export default Footer;
