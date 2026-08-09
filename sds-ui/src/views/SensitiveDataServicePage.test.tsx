/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensitiveDataServicePage from './SensitiveDataServicePage.tsx';

describe('SensitiveDataServicePage', () => {
    const setBreadcrumbs = jest.fn();
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        (globalThis.fetch as jest.Mock | undefined)?.mockRestore?.();
        consoleLogSpy.mockRestore();
    });

    it('calls setBreadcrumbs once on mount with Home and page title', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: new Headers(),
        });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        expect(setBreadcrumbs).toHaveBeenCalledTimes(1);
        expect(setBreadcrumbs).toHaveBeenCalledWith([
            { title: 'Home', href: undefined },
            { title: 'Sensitive Data Service', href: '' },
        ]);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).not.toBe('(loading...)');
        });
    });

    it('shows a loading placeholder before the fetch resolves', async () => {
        let resolveFetch: (value: any) => void = () => {};
        globalThis.fetch = jest.fn().mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        expect(document.getElementById('xmlLastModified')?.innerHTML).toBe('(loading...)');

        await act(async () => {
            resolveFetch({ ok: true, headers: new Headers() });
            await Promise.resolve();
        });
    });

    it('shows a formatted date once the Last-Modified header resolves', async () => {
        const headers = new Headers();
        headers.set('last-modified', 'Wed, 21 Oct 2015 07:28:00 GMT');
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, headers });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).not.toBe('(loading...)');
        });
        expect(document.getElementById('xmlLastModified')?.innerHTML).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('shows a message when the Last-Modified header is missing', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers() });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).toBe('[Last-Modified header not available]');
        });
    });

    it('shows an error message when the fetch response is not ok', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, headers: new Headers() });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).toContain('Failed to fetch file information');
        });
    });

    it('shows an error message when the network request fails outright', async () => {
        globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).toContain('Network failure');
        });
    });

    it('shows a generic error message for a non-Error rejection', async () => {
        globalThis.fetch = jest.fn().mockRejectedValue('boom');

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).toBe('An unknown error occurred');
        });
    });

    it('renders the resource table with links to categories, zones and layers endpoints', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers() });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        const rows = document.querySelectorAll('table.table tbody tr');
        expect(rows.length).toBe(4);
        expect(rows[1].querySelector('a')?.getAttribute('href')).toMatch(/\/categories$/);
        expect(rows[2].querySelector('a')?.getAttribute('href')).toMatch(/\/zones$/);
        expect(rows[3].querySelector('a')?.getAttribute('href')).toMatch(/\/layers$/);

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).not.toBe('(loading...)');
        });
    });

    it('renders the page heading', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers() });

        render(<SensitiveDataServicePage setBreadcrumbs={setBreadcrumbs} />);

        expect(screen.getAllByText('Sensitive Data Service')[0]).toBeInTheDocument();

        await waitFor(() => {
            expect(document.getElementById('xmlLastModified')?.innerHTML).not.toBe('(loading...)');
        });
    });
});
