/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

jest.mock(
    '@ala/common-ui',
    () => ({
        __esModule: true,
        Banner: (props: any) => <div data-testid="banner" data-url={props.bannerUrl} />,
        Header: (props: any) => <div data-testid="header" data-logged-in={String(props.isLoggedIn)} />,
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

jest.mock('./views/Regions.tsx', () => ({
    __esModule: true,
    default: () => <div data-testid="regions-view" />,
}));

jest.mock('./views/Region.tsx', () => ({
    __esModule: true,
    default: () => <div data-testid="region-view" />,
}));

import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import * as commonUi from '@ala/common-ui';
import App from './App';

describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing until the CSS has finished loading', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation(() => {
            // do not call setCssLoaded — simulate CSS still loading
        });

        const { container } = render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders Header, Breadcrumbs, Banner, the routed view and Footer once CSS has loaded', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter initialEntries={['/']}>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
        expect(screen.getByTestId('banner')).toBeInTheDocument();
        expect(screen.getByTestId('regions-view')).toBeInTheDocument();
        expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('routes to the Region view when the path is /region', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter initialEntries={['/region']}>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('region-view')).toBeInTheDocument();
        expect(screen.queryByTestId('regions-view')).not.toBeInTheDocument();
    });

    it('initialises the breadcrumbs with a single Home entry', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Home');
    });

    it('calls checkLoginState once on mount', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);
    });

    it('re-checks login state when the document becomes visible again', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

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

        const { unmount } = render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        removeSpy.mockRestore();
    });

    it('passes isLoggedIn=undefined to Header/Footer before login state resolves', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation((_b, _e, _c, setCssLoaded) => {
            setCssLoaded(true);
        });

        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('header')).toHaveAttribute('data-logged-in', 'undefined');
        expect(screen.getByTestId('footer')).toHaveAttribute('data-logged-in', 'undefined');
    });
});
