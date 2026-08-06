/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import Footer from './footer.tsx';

// Trimmed down version of static-server/static/common/footer.mustache, containing
// just the parts relevant to Footer's behaviour: {{containerClass}}, loginStatus, loginBtn/logoutBtn.
const footerMustache = `
<footer class="site-footer {{containerClass}}" id="colophon">
    <div class="account {{loginStatus}}">
        <a href="{{loginURL}}" class="btn btn-primary btn-sm loginBtn">Login</a>
        <a href="{{logoutURL}}" class="btn btn-outline-light btn-sm logoutBtn" role="button">Logout</a>
    </div>
</footer>
`;

function mockFetchOnce(text: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        text: () => Promise.resolve(text),
    });
}

describe('Footer', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders nothing when footerUrl is not provided', () => {
        const {container} = render(<Footer footerUrl=""/>);
        expect(container).toBeEmptyDOMElement();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches the footerUrl and injects the resulting HTML', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache"/>);

        expect(global.fetch).toHaveBeenCalledWith('http://static/footer.mustache');
        expect(await screen.findByRole('contentinfo')).toBeInTheDocument();
    });

    it('substitutes containerClass with the default value when not provided', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache"/>);

        const footer = await screen.findByRole('contentinfo');
        expect(footer).toHaveClass('container-fluid');
    });

    it('substitutes containerClass with the provided value', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache" containerClass="container"/>);

        const footer = await screen.findByRole('contentinfo');
        expect(footer).toHaveClass('container');
        expect(footer).not.toHaveClass('container-fluid');
    });

    it('removes the href attribute from loginBtn and logoutBtn elements', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache"/>);

        const footer = await screen.findByRole('contentinfo');
        await waitFor(() => expect(footer.querySelector('.loginBtn')).not.toHaveAttribute('href'));
        expect(footer.querySelector('.logoutBtn')).not.toHaveAttribute('href');
    });

    it('calls loginFn when the login button is clicked', async () => {
        const loginFn = jest.fn();
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache" loginFn={loginFn}/>);

        const footer = await screen.findByRole('contentinfo');
        const loginLink = footer.querySelector('.loginBtn') as HTMLElement;
        await waitFor(() => expect(loginLink).not.toHaveAttribute('href'));
        fireEvent.click(loginLink);
        expect(loginFn).toHaveBeenCalled();
    });

    it('calls logoutFn when the logout button is clicked', async () => {
        const logoutFn = jest.fn();
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache" logoutFn={logoutFn}/>);

        const footer = await screen.findByRole('contentinfo');
        const logoutLink = footer.querySelector('.logoutBtn') as HTMLElement;
        await waitFor(() => expect(logoutLink).not.toHaveAttribute('href'));
        fireEvent.click(logoutLink);
        expect(logoutFn).toHaveBeenCalled();
    });

    it('shows signedIn state when isLoggedIn is true', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache" isLoggedIn={true}/>);

        const footer = await screen.findByRole('contentinfo');
        const account = footer.querySelector('.account') as HTMLElement;
        await waitFor(() => expect(account).toHaveClass('signedIn'));
        expect(account).not.toHaveClass('signedOut');
    });

    it('shows signedOut state when isLoggedIn is false', async () => {
        mockFetchOnce(footerMustache);
        render(<Footer footerUrl="http://static/footer.mustache" isLoggedIn={false}/>);

        const footer = await screen.findByRole('contentinfo');
        const account = footer.querySelector('.account') as HTMLElement;
        await waitFor(() => expect(account).toHaveClass('signedOut'));
    });
});
