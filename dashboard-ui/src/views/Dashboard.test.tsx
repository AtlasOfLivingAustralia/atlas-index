/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from './Dashboard.tsx';

describe('DashboardPage', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows a loading spinner before the dashboard data has been fetched', () => {
        global.fetch = jest.fn(() => new Promise(() => {})) as any;

        const { container } = render(<DashboardPage />);

        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(screen.queryByText('Download as CSV')).not.toBeInTheDocument();
    });

    it('renders only the sections present in the fetched data', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        occurrenceCount: { count: 12345, url: 'https://example.org/occurrences' },
                    },
                }),
        }) as any;

        render(<DashboardPage />);

        await waitFor(() => expect(screen.getByText('12,345')).toBeInTheDocument());

        // Only the occurrenceCount card should be present; other optional
        // sections were omitted from the fetched payload.
        expect(screen.queryByText('Datasets')).not.toBeInTheDocument();
        expect(screen.getByText('Download as CSV')).toBeInTheDocument();
    });

    it('renders nothing (no crash) when the fetched data object is empty', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: {} }),
        }) as any;

        render(<DashboardPage />);

        await waitFor(() => expect(screen.getByText('Download as CSV')).toBeInTheDocument());
        expect(screen.queryByText('Occurrence Records')).not.toBeInTheDocument();
    });

    it('links the CSV download button to the dashboard zip URL', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: {} }),
        }) as any;

        render(<DashboardPage />);

        const link = await screen.findByText('Download as CSV');
        expect(link.closest('a')).toHaveAttribute('href', 'https://dashboard.example.org/dashboard.zip');
    });

    it('renders the most-recently-added dataset link when datasets data is present', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        datasets: {
                            count: 10,
                            tables: [{ rows: [] }],
                            mostRecent: { name: 'My Dataset', url: 'https://example.org/dataset' },
                        },
                    },
                }),
        }) as any;

        render(<DashboardPage />);

        const link = await screen.findByText('My Dataset');
        expect(link.closest('a')).toHaveAttribute('href', 'https://example.org/dataset');
    });
});
