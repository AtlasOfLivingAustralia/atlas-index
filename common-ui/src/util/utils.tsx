/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Will set the elements with classes signedIn and signedOut to display: inline-block or display: none depending
// on the isLoggedIn value. e.g. signedIn elements are visible when isLoggedIn is true.
export function showLoginLogoutButtons(isLoggedIn: boolean | undefined) {
    setElementDisplayByClassName("signedIn", isLoggedIn ? "inline-block" : "none");
    setElementDisplayByClassName("signedOut", !isLoggedIn ? "inline-block" : "none");
}

export function setClickEventByClassName(className: string, clickFn: (() => void) | undefined) {
    if (!clickFn) {
        return;
    }

    const elements = document.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', clickFn);
    }
}

export function setClickEventById(id: string, clickFn: (() => void) | undefined) {
    if (!clickFn) {
        return;
    }

    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', clickFn);
    }
}


export function setElementDisplayByClassName(className: string, displayValue: string) {
    const elements = document.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
        (elements[i] as HTMLElement).style.display = displayValue;
    }
}

export function setElementDisplayById(id: string, displayValue: string) {
    const element = document.getElementById(id);
    if (element) {
        (element as HTMLElement).style.display = displayValue;
    }
}

/**
 * Injects common information into the document head and body.
 * - Adds build information and environment to meta tags
 * - Loads a common JavaScript file if provided
 * - Loads a common CSS file if provided, and sets a state indicating whether the CSS has been loaded
 *
 * @param buildInfo information for JSON.stringify to be and added to a meta tag
 * @param env the environment the application is running in (e.g., 'development', 'production')
 * @param js_url URL to a common JavaScript file to be loaded by the client
 * @param css_url URL to a common CSS file to be loaded by the client
 * @param setCssLoaded a function to set the state indicating whether the CSS has been loaded
 */
export function injectCommonInfo(buildInfo: any, env: string, js_url: string, css_url: string, setCssLoaded: (loaded: boolean) => void) {
    // Add build info to head meta tags
    const meta = document.createElement('meta');
    meta.name = 'buildInfo';
    meta.content = JSON.stringify(buildInfo);
    document.head.appendChild(meta);

    // Add env value to head meta tags
    const envMeta = document.createElement('meta');
    envMeta.name = 'env';
    envMeta.content = JSON.stringify({env: env});
    document.head.appendChild(envMeta);

    if (css_url) {
        // load the common CSS used by both the header and footer
        fetch(css_url).then((response) => {
            if (response.ok) {
                response.text().then((text) => {
                    const style = document.createElement('style');
                    style.innerHTML = text;
                    document.head.appendChild(style);
                });
            }
        }).finally(() => {
            // set css loaded to true even if the fetch fails
            setCssLoaded(true);
        });
    } else {
        setCssLoaded(true);
    }

    if (js_url) {
        // load the common js
        const script = document.createElement('script');
        script.src = js_url;
        script.async = true;
        document.body.appendChild(script);
    }
}
