/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Unit tests for App.tsx complementing tests/synthetic/Dashboard.spec.ts's
// "App.tsx" describe block. The synthetic test exercises the
// visibilitychange listener end-to-end in a real browser; here we verify
// the same behaviour (plus the CSS-loading gate and login/logout wiring)
// in isolation with mocked dependencies.

jest.mock(
    '@ala/common-ui',
    () => ({
        __esModule: true,
        Banner: (props: any) => <div data-testid="banner" data-url={props.bannerUrl} />,
        Header: (props: any) => (
            <div data-testid="header" data-logged-in={String(props.isLoggedIn)}>
                <button onClick={props.loginFn}>login</button>
                <button onClick={props.logoutFn}>logout</button>
            </div>
        ),
        Footer: (props: any) => <div data-testid="footer" data-logged-in={String(props.isLoggedIn)} />,
        Breadcrumbs: ({ breadcrumbs }: any) => (
            <div data-testid="breadcrumbs">{breadcrumbs.map((b: any) => b.title).join(',')}</div>
        ),
        UserContext: { Provider: ({ children }: any) => children },
        injectCommonInfo: jest.fn(),
        checkLoginState: jest.fn(),
        handleLogin: jest.fn(),
        handleLogout: jest.fn(),
    }),
    { virtual: true }
);

jest.mock('./views/Dashboard.tsx', () => ({
    __esModule: true,
    default: () => <div data-testid="dashboard-view" />,
}));

import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as commonUi from '@ala/common-ui';
import App from './App.tsx';

describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing until the CSS has finished loading', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation(() => {
            // do not call setCssLoaded — simulate CSS still loading
        });

        const { container } = render(<App />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders Header, Breadcrumbs, Banner, Dashboard and Footer once CSS has loaded', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);

        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
        expect(screen.getByTestId('banner')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
        expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('initialises the breadcrumbs with Home and Dashboard entries', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);

        expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Home,Dashboard');
    });

    it('calls checkLoginState once on mount', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);
        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);
    });

    it('re-checks login state when the document becomes visible again', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);
        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            writable: true,
            configurable: true,
        });

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(2);
    });

    it('does not re-check login state when the document becomes hidden', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);
        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden',
            writable: true,
            configurable: true,
        });

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);
    });

    it('removes the visibilitychange listener on unmount', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        const removeSpy = jest.spyOn(document, 'removeEventListener');
        const { unmount } = render(<App />);
        unmount();

        expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        removeSpy.mockRestore();
    });

    it('calls handleLogin with the API URL when the login button is clicked', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);
        fireEvent.click(screen.getByText('login'));

        expect(commonUi.handleLogin).toHaveBeenCalledWith(process.env.VITE_APP_API_URL);
    });

    it('calls handleLogout with the API and base URLs when the logout button is clicked', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);
        fireEvent.click(screen.getByText('logout'));

        expect(commonUi.handleLogout).toHaveBeenCalledWith(
            process.env.VITE_APP_API_URL,
            process.env.VITE_APP_BASE_URL
        );
    });

    it('passes isLoggedIn=undefined to Header/Footer before login state resolves', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(<App />);

        expect(screen.getByTestId('header')).toHaveAttribute('data-logged-in', 'undefined');
        expect(screen.getByTestId('footer')).toHaveAttribute('data-logged-in', 'undefined');
    });
});
