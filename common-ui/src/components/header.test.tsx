/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from './header.tsx';

// Trimmed down version of static-server/static/common/banner.mustache, containing
// just the parts relevant to Header's behaviour: {{containerClass}}, {{searchServer}}{{searchPath}},
// loginStatus, loginBtn/logoutBtn, and the autocomplete search input.
const headerMustache = `
<div id="wrapper-navbar">
    <nav class="navbar {{containerClass}}">
        <div class="account {{loginStatus}}">
            <a href="{{loginURL}}" role="button" class="btn btn-primary btn-sm loginBtn">Login</a>
            <a href="{{logoutURL}}" class="btn btn-outline-light btn-sm logoutBtn" role="button">Logout</a>
        </div>
        <form method="get" action="{{searchServer}}{{searchPath}}" class="search-form">
            <input id="autocompleteHeader" type="text" name="q"/>
        </form>
    </nav>
</div>
`;

function mockFetchOnce(text: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        text: () => Promise.resolve(text),
    });
}

describe('Header', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.querySelectorAll('script').forEach(el => el.remove());
    });

    it('renders nothing when headerUrl is not provided', () => {
        const {container} = render(<Header headerUrl=""/>);
        expect(container).toBeEmptyDOMElement();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches the headerUrl and injects the resulting HTML', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache"/>);

        expect(global.fetch).toHaveBeenCalledWith('http://static/banner.mustache');
        expect(await screen.findByRole('navigation')).toBeInTheDocument();
    });

    it('substitutes containerClass with the default value when not provided', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache"/>);

        const nav = await screen.findByRole('navigation');
        expect(nav).toHaveClass('container-fluid');
    });

    it('substitutes containerClass with the provided value', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" containerClass="container"/>);

        const nav = await screen.findByRole('navigation');
        expect(nav).toHaveClass('container');
        expect(nav).not.toHaveClass('container-fluid');
    });

    it('substitutes searchServer and searchPath into the search form action', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" searchBaseUrl="https://search.test/bie"/>);

        const form = (await screen.findByRole('navigation')).querySelector('form') as HTMLFormElement;
        expect(form.getAttribute('action')).toBe('https://search.test/bie');
    });

    it('removes the href attribute from loginBtn and logoutBtn elements', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache"/>);

        const nav = await screen.findByRole('navigation');
        await waitFor(() => expect(nav.querySelector('.loginBtn')).not.toHaveAttribute('href'));
        expect(nav.querySelector('.logoutBtn')).not.toHaveAttribute('href');
    });

    it('calls loginFn when the login button is clicked', async () => {
        const loginFn = jest.fn();
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" loginFn={loginFn}/>);

        const nav = await screen.findByRole('navigation');
        const loginLink = nav.querySelector('.loginBtn') as HTMLElement;
        await waitFor(() => expect(loginLink).not.toHaveAttribute('href'));
        fireEvent.click(loginLink);
        expect(loginFn).toHaveBeenCalled();
    });

    it('calls logoutFn when the logout button is clicked', async () => {
        const logoutFn = jest.fn();
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" logoutFn={logoutFn}/>);

        const nav = await screen.findByRole('navigation');
        const logoutLink = nav.querySelector('.logoutBtn') as HTMLElement;
        await waitFor(() => expect(logoutLink).not.toHaveAttribute('href'));
        fireEvent.click(logoutLink);
        expect(logoutFn).toHaveBeenCalled();
    });

    it('shows signedIn state when isLoggedIn is true', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" isLoggedIn={true}/>);

        const nav = await screen.findByRole('navigation');
        const account = nav.querySelector('.account') as HTMLElement;
        await waitFor(() => expect(account).toHaveClass('signedIn'));
        expect(account).not.toHaveClass('signedOut');
    });

    it('shows signedOut state when isLoggedIn is false', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" isLoggedIn={false}/>);

        const nav = await screen.findByRole('navigation');
        const account = nav.querySelector('.account') as HTMLElement;
        await waitFor(() => expect(account).toHaveClass('signedOut'));
    });

    it('loads jsUrl scripts after the header HTML has been injected', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache" jsUrl="http://static/application.js"/>);

        await screen.findByRole('navigation');
        await waitFor(() => {
            expect(document.querySelector('script[src="http://static/application.js"]')).toBeInTheDocument();
        });
    });

    it('does not load any scripts when jsUrl is not provided', async () => {
        mockFetchOnce(headerMustache);
        render(<Header headerUrl="http://static/banner.mustache"/>);

        await screen.findByRole('navigation');
        expect(document.querySelectorAll('script').length).toBe(0);
    });
});
