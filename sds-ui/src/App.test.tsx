/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

jest.mock(
    '@ala/common-ui',
    () => {
        return {
            __esModule: true,
            injectCommonInfo: jest.fn((_buildInfo: any, _env: any, _cssUrl: any, setCssLoaded: (v: boolean) => void) => {
                setCssLoaded(true);
            }),
            checkLoginState: jest.fn(),
            handleLogin: jest.fn(),
            handleLogout: jest.fn(),
            UserContext: { Provider: ({ children }: any) => children },
            Header: (props: any) => <div data-testid="header" data-logged-in={String(props.isLoggedIn)} />,
            Footer: (props: any) => <div data-testid="footer" data-logged-in={String(props.isLoggedIn)} />,
            Banner: () => <div data-testid="banner" />,
            Breadcrumbs: ({ breadcrumbs }: any) => (
                <div data-testid="breadcrumbs">{breadcrumbs.map((b: any) => b.title).join(',')}</div>
            ),
        };
    },
    { virtual: true }
);

jest.mock('./views/SensitiveDataServicePage.tsx', () => ({
    __esModule: true,
    default: () => {
        return <div data-testid="sds-page" />;
    },
}));

import App from './App';
import * as commonUi from '@ala/common-ui';

describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation(
            (_buildInfo: any, _env: any, _cssUrl: any, setCssLoaded: (v: boolean) => void) => {
                setCssLoaded(true);
            }
        );
    });

    it('renders nothing until CSS has loaded', () => {
        (commonUi.injectCommonInfo as jest.Mock).mockImplementation(() => {
            // do not call setCssLoaded synchronously
        });

        const { container } = render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders Header, Breadcrumbs, Banner, routed page and Footer once CSS is loaded', () => {
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
        expect(screen.getByTestId('banner')).toBeInTheDocument();
        expect(screen.getByTestId('sds-page')).toBeInTheDocument();
        expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('calls checkLoginState on mount', () => {
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(commonUi.checkLoginState).toHaveBeenCalledTimes(1);
    });

    it('re-checks login state when the document becomes visible again', () => {
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

    it('removes the visibilitychange listener on unmount', () => {
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
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByTestId('header')).toHaveAttribute('data-logged-in', 'undefined');
        expect(screen.getByTestId('footer')).toHaveAttribute('data-logged-in', 'undefined');
    });
});
