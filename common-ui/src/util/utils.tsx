/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Will set the elements with classes signedIn and signedOut to display: inline-block or display: none depending
// on the isLoggedIn value. e.g. signedIn elements are visible when isLoggedIn is true.
export function showLoginLogoutButtons(isLoggedIn: boolean | undefined, scope: Element | Document | null = document) {
    const s = scope ?? document;

    // newer mustache toggle (add signedIn or signedOut to "account loginStatus" element)
    const loginStatusElements = s.getElementsByClassName("loginStatus");
    for (let i = 0; i < loginStatusElements.length; i++) {
        const el = loginStatusElements[i];
        el.classList.toggle("signedIn", !!isLoggedIn);
        el.classList.toggle("signedOut", !isLoggedIn);
    }

    // older header/footer toggle - only apply when no loginStatus elements are present
    if (loginStatusElements.length === 0) {
        setElementDisplayByClassName("signedIn", isLoggedIn ? "inline-block" : "none", s);
        setElementDisplayByClassName("signedOut", !isLoggedIn ? "inline-block" : "none", s);
    }
}

export function setClickEventByClassName(className: string, clickFn: (() => void) | undefined, scope: Element | Document | null = document) {
    if (!clickFn) {
        return;
    }
    const s = scope ?? document;

    const elements = s.getElementsByClassName(className);
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


export function setElementDisplayByClassName(className: string, displayValue: string, scope: Element | Document | null = document) {
    const s = scope ?? document;
    const elements = s.getElementsByClassName(className);
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
 * @param css_url URL to a common CSS file to be loaded by the client, comma delimted list supported
 * @param setCssLoaded a function to set the state indicating whether the CSS has been loaded
 */
export function injectCommonInfo(buildInfo: any, env: string, css_url: string, setCssLoaded: (loaded: boolean) => void) {
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
        // load the common CSS via <link> elements to preserve relative paths (fonts, images, etc.)
        const cssUrls = css_url.split(',').map(u => u.trim()).filter(u => u.length > 0);
        if (cssUrls.length === 0) {
            setCssLoaded(true);
        } else {
            let remaining = cssUrls.length;
            const onSettled = () => {
                if (--remaining === 0) setCssLoaded(true);
            };
            cssUrls.reverse().forEach(url => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.onload = onSettled;
                link.onerror = onSettled; // set loaded even if a stylesheet fails
                // insert at the top of <head> so the app's own CSS takes precedence
                document.head.insertBefore(link, document.head.firstChild);
            });
        }
    } else {
        setCssLoaded(true);
    }
}

/**
 * Loads common JS scripts sequentially to preserve dependency order.
 * Must be called AFTER the header HTML has been injected into the DOM,
 * because scripts like application.js expect elements (e.g. #autocompleteHeader) to be present.
 *
 * @param js_url comma-delimited list of JS URLs to load in order
 */
export function injectCommonJs(js_url: string) {
    if (!js_url) return;
    const jsUrls = js_url.split(',').map(u => u.trim()).filter(u => u.length > 0);
    const loadNext = (index: number) => {
        if (index >= jsUrls.length) return;
        const script = document.createElement('script');
        script.src = jsUrls[index];
        script.onload = () => setTimeout(() => loadNext(index + 1), 0);
        script.onerror = () => setTimeout(() => loadNext(index + 1), 0);
        document.body.appendChild(script);
    };
    loadNext(0);
}

/**
 * sanitize and replace mustache tags
 * - {{containerClass}}; value substituted
 * - {{searchServer}}{{searchPath}}; value substituted
 * - {{loginStatus}}; braces removed
 * - {{loginURL}}; braces removed
 * - {{logoutUrl}}; braces removed
 * @param str
 */
export function cleanMustache(str: string, containerClass: string, speciesBaseUrl?: string): string {
    str = str.replace(/\{\{containerClass}}/g, containerClass);

    if (speciesBaseUrl) {
        str = str.replace(/\{\{searchServer\}\}\{\{searchPath\}\}/g, speciesBaseUrl)
    }

    // Remove all "{{" and "}}". This is messing with class selectors.
    return str.replace(/\{\{|}}/g, '');
}
