/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import '@testing-library/jest-dom';
import {
    cleanMustache,
    injectCommonInfo,
    injectCommonJs,
    setClickEventByClassName,
    setClickEventById,
    setElementDisplayByClassName,
    setElementDisplayById,
    showLoginLogoutButtons,
} from './utils.tsx';

describe('showLoginLogoutButtons', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('toggles signedIn/signedOut classes on loginStatus elements when logged in', () => {
        document.body.innerHTML = '<div class="account loginStatus"></div>';
        showLoginLogoutButtons(true);
        const el = document.querySelector('.loginStatus') as HTMLElement;
        expect(el.classList.contains('signedIn')).toBe(true);
        expect(el.classList.contains('signedOut')).toBe(false);
    });

    it('toggles signedIn/signedOut classes on loginStatus elements when logged out', () => {
        document.body.innerHTML = '<div class="account loginStatus"></div>';
        showLoginLogoutButtons(false);
        const el = document.querySelector('.loginStatus') as HTMLElement;
        expect(el.classList.contains('signedIn')).toBe(false);
        expect(el.classList.contains('signedOut')).toBe(true);
    });

    it('falls back to display toggling when no loginStatus elements present', () => {
        document.body.innerHTML = '<div class="signedIn"></div><div class="signedOut"></div>';
        showLoginLogoutButtons(true);
        const signedIn = document.querySelector('.signedIn') as HTMLElement;
        const signedOut = document.querySelector('.signedOut') as HTMLElement;
        expect(signedIn.style.display).toBe('inline-block');
        expect(signedOut.style.display).toBe('none');
    });

    it('falls back to display toggling for signed out when isLoggedIn is false', () => {
        document.body.innerHTML = '<div class="signedIn"></div><div class="signedOut"></div>';
        showLoginLogoutButtons(false);
        const signedIn = document.querySelector('.signedIn') as HTMLElement;
        const signedOut = document.querySelector('.signedOut') as HTMLElement;
        expect(signedIn.style.display).toBe('none');
        expect(signedOut.style.display).toBe('inline-block');
    });

    it('does not apply the fallback display toggling when loginStatus elements exist', () => {
        document.body.innerHTML = '<div class="loginStatus"></div><div class="signedIn"></div>';
        showLoginLogoutButtons(true);
        const signedIn = document.querySelector('.signedIn') as HTMLElement;
        expect(signedIn.style.display).toBe('');
    });

    it('uses the provided scope instead of document', () => {
        const container = document.createElement('div');
        container.innerHTML = '<div class="loginStatus"></div>';
        document.body.appendChild(document.createElement('div')).innerHTML = '<div class="loginStatus"></div>';
        showLoginLogoutButtons(true, container);
        const el = container.querySelector('.loginStatus') as HTMLElement;
        expect(el.classList.contains('signedIn')).toBe(true);
    });

    it('handles undefined isLoggedIn as falsy', () => {
        document.body.innerHTML = '<div class="loginStatus"></div>';
        showLoginLogoutButtons(undefined);
        const el = document.querySelector('.loginStatus') as HTMLElement;
        expect(el.classList.contains('signedOut')).toBe(true);
    });
});

describe('setClickEventByClassName', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('attaches the click handler to all matching elements', () => {
        document.body.innerHTML = '<button class="myBtn"></button><button class="myBtn"></button>';
        const fn = jest.fn();
        setClickEventByClassName('myBtn', fn);
        document.querySelectorAll('.myBtn').forEach(el => (el as HTMLElement).click());
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does nothing when clickFn is undefined', () => {
        document.body.innerHTML = '<button class="myBtn"></button>';
        expect(() => setClickEventByClassName('myBtn', undefined)).not.toThrow();
    });

    it('uses provided scope', () => {
        const container = document.createElement('div');
        container.innerHTML = '<button class="myBtn"></button>';
        const fn = jest.fn();
        setClickEventByClassName('myBtn', fn, container);
        (container.querySelector('.myBtn') as HTMLElement).click();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('setClickEventById', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('attaches the click handler to the matching element', () => {
        document.body.innerHTML = '<button id="myBtn"></button>';
        const fn = jest.fn();
        setClickEventById('myBtn', fn);
        (document.getElementById('myBtn') as HTMLElement).click();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does nothing when clickFn is undefined', () => {
        document.body.innerHTML = '<button id="myBtn"></button>';
        expect(() => setClickEventById('myBtn', undefined)).not.toThrow();
    });

    it('does nothing when element does not exist', () => {
        const fn = jest.fn();
        expect(() => setClickEventById('missing', fn)).not.toThrow();
    });
});

describe('setElementDisplayByClassName', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('sets display style on all matching elements', () => {
        document.body.innerHTML = '<div class="target"></div><div class="target"></div>';
        setElementDisplayByClassName('target', 'block');
        document.querySelectorAll('.target').forEach(el => {
            expect((el as HTMLElement).style.display).toBe('block');
        });
    });

    it('uses provided scope', () => {
        const container = document.createElement('div');
        container.innerHTML = '<div class="target"></div>';
        setElementDisplayByClassName('target', 'none', container);
        expect((container.querySelector('.target') as HTMLElement).style.display).toBe('none');
    });
});

describe('setElementDisplayById', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('sets display style on the matching element', () => {
        document.body.innerHTML = '<div id="target"></div>';
        setElementDisplayById('target', 'flex');
        expect((document.getElementById('target') as HTMLElement).style.display).toBe('flex');
    });

    it('does nothing when element does not exist', () => {
        expect(() => setElementDisplayById('missing', 'flex')).not.toThrow();
    });
});

describe('injectCommonInfo', () => {
    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('adds buildInfo and env meta tags to head', () => {
        const setCssLoaded = jest.fn();
        injectCommonInfo({version: '1.0'}, 'test', '', setCssLoaded);
        const buildInfoMeta = document.head.querySelector('meta[name="buildInfo"]');
        const envMeta = document.head.querySelector('meta[name="env"]');
        expect(buildInfoMeta?.getAttribute('content')).toBe(JSON.stringify({version: '1.0'}));
        expect(envMeta?.getAttribute('content')).toBe(JSON.stringify({env: 'test'}));
    });

    it('calls setCssLoaded immediately when css_url is empty', () => {
        const setCssLoaded = jest.fn();
        injectCommonInfo({}, 'test', '', setCssLoaded);
        expect(setCssLoaded).toHaveBeenCalledWith(true);
    });

    it('adds link elements for each css url and calls setCssLoaded once all loaded', () => {
        const setCssLoaded = jest.fn();
        injectCommonInfo({}, 'test', 'a.css, b.css', setCssLoaded);
        const links = document.head.querySelectorAll('link[rel="stylesheet"]');
        expect(links.length).toBe(2);
        expect(setCssLoaded).not.toHaveBeenCalled();

        links.forEach(link => {
            (link as HTMLLinkElement).onload?.(new Event('load'));
        });
        expect(setCssLoaded).toHaveBeenCalledWith(true);
    });

    it('still calls setCssLoaded if a stylesheet errors', () => {
        const setCssLoaded = jest.fn();
        injectCommonInfo({}, 'test', 'a.css', setCssLoaded);
        const link = document.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement;
        link.onerror?.(new Event('error'));
        expect(setCssLoaded).toHaveBeenCalledWith(true);
    });

    it('calls setCssLoaded when css_url only contains whitespace/empty entries', () => {
        const setCssLoaded = jest.fn();
        injectCommonInfo({}, 'test', ' , ,', setCssLoaded);
        expect(setCssLoaded).toHaveBeenCalledWith(true);
        expect(document.head.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    });
});

describe('injectCommonJs', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    it('does nothing when js_url is empty', () => {
        injectCommonJs('');
        expect(document.body.querySelectorAll('script').length).toBe(0);
    });

    it('appends a script tag for the js url', () => {
        injectCommonJs('a.js');
        const script = document.body.querySelector('script');
        expect(script?.getAttribute('src')).toBe('a.js');
    });

    it('loads scripts sequentially', () => {
        jest.useFakeTimers();
        injectCommonJs('a.js, b.js');
        let scripts = document.body.querySelectorAll('script');
        expect(scripts.length).toBe(1);
        expect(scripts[0].getAttribute('src')).toBe('a.js');

        scripts[0].onload?.(new Event('load'));
        jest.runAllTimers();

        scripts = document.body.querySelectorAll('script');
        expect(scripts.length).toBe(2);
        expect(scripts[1].getAttribute('src')).toBe('b.js');
    });

    it('continues to the next script when one errors', () => {
        jest.useFakeTimers();
        injectCommonJs('a.js, b.js');
        let scripts = document.body.querySelectorAll('script');
        scripts[0].onerror?.(new Event('error'));
        jest.runAllTimers();
        scripts = document.body.querySelectorAll('script');
        expect(scripts.length).toBe(2);
        expect(scripts[1].getAttribute('src')).toBe('b.js');
    });
});

describe('cleanMustache', () => {
    it('replaces containerClass placeholders', () => {
        expect(cleanMustache('{{containerClass}} div', 'my-class')).toBe('my-class div');
    });

    it('replaces searchServer/searchPath placeholders when speciesBaseUrl is provided', () => {
        expect(cleanMustache('{{searchServer}}{{searchPath}}', 'cls', 'https://example.org/species')).toBe(
            'https://example.org/species'
        );
    });

    it('does not touch searchServer/searchPath placeholders without speciesBaseUrl', () => {
        const result = cleanMustache('{{searchServer}}{{searchPath}}', 'cls');
        expect(result).toBe('searchServersearchPath');
    });

    it('removes remaining mustache braces', () => {
        expect(cleanMustache('{{loginStatus}} {{loginURL}} {{logoutUrl}}', 'cls')).toBe('loginStatus loginURL logoutUrl');
    });
});
