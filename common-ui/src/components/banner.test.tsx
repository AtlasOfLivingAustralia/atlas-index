/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import Banner from './banner.tsx';

function mockFetchOnce(data: any) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(data),
    });
}

describe('Banner', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders nothing when bannerUrl is not provided', () => {
        const {container} = render(<Banner bannerUrl="" scope="regions"/>);
        expect(container).toBeEmptyDOMElement();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches the bannerUrl and renders the global message', async () => {
        mockFetchOnce({
            global: {
                message: 'A global message',
                severity: 'INFO',
                updated: '2026-01-01T00:00:00Z',
            },
        });

        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);

        expect(global.fetch).toHaveBeenCalledWith('http://static/status.json');
        expect(await screen.findByText('A global message')).toBeInTheDocument();
    });

    it('renders a message matching the given scope', async () => {
        mockFetchOnce({
            regions: {
                message: 'Regions specific message',
                severity: 'WARNING',
                updated: '2026-01-01T00:00:00Z',
            },
        });

        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        expect(await screen.findByText('Regions specific message')).toBeInTheDocument();
    });

    it('does not render messages for a different scope', async () => {
        mockFetchOnce({
            specimens: {
                message: 'Specimens only message',
                severity: 'INFO',
                updated: '2026-01-01T00:00:00Z',
            },
        });

        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(screen.queryByText('Specimens only message')).not.toBeInTheDocument();
    });

    it('does not render messages with an empty message string', async () => {
        mockFetchOnce({
            global: {
                message: '',
                severity: 'INFO',
                updated: '2026-01-01T00:00:00Z',
            },
        });

        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(document.querySelector('.alert')).not.toBeInTheDocument();
    });

    it('applies the correct alert class for each severity', async () => {
        mockFetchOnce({
            global: {message: 'Danger message', severity: 'DANGER', updated: '2026-01-01T00:00:00Z'},
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        const alert = await screen.findByText('Danger message');
        expect(alert.closest('.alert')).toHaveClass('alert-danger');
    });

    it('renders the message content as HTML', async () => {
        mockFetchOnce({
            global: {
                message: '<strong>Bold</strong> message',
                severity: 'INFO',
                updated: '2026-01-01T00:00:00Z',
            },
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        expect(await screen.findByText('Bold')).toBeInTheDocument();
        expect(document.querySelector('strong')).toBeInTheDocument();
    });

    it('does not render a close button when closable is not set', async () => {
        mockFetchOnce({
            global: {message: 'Not closable', severity: 'INFO', updated: '2026-01-01T00:00:00Z'},
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await screen.findByText('Not closable');
        expect(screen.queryByRole('button', {name: 'Close'})).not.toBeInTheDocument();
    });

    it('renders a close button when closable is true, and removes the message when clicked', async () => {
        mockFetchOnce({
            global: {message: 'Closable message', severity: 'INFO', updated: '2026-01-01T00:00:00Z', closable: true},
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await screen.findByText('Closable message');

        fireEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(screen.queryByText('Closable message')).not.toBeInTheDocument();
    });

    it('persists the closed state in localStorage', async () => {
        mockFetchOnce({
            global: {message: 'Closable message', severity: 'INFO', updated: '2026-01-01T00:00:00Z', closable: true},
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await screen.findByText('Closable message');

        fireEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(localStorage.getItem('bannerLastClosed_global')).not.toBeNull();
    });

    it('does not re-show a message that was previously closed and not updated since', async () => {
        localStorage.setItem('bannerLastClosed_global', '2026-06-01T00:00:00Z');
        mockFetchOnce({
            global: {
                message: 'Old message',
                severity: 'INFO',
                updated: '2026-01-01T00:00:00Z', // updated before the last closed date
                closable: true,
            },
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(screen.queryByText('Old message')).not.toBeInTheDocument();
    });

    it('re-shows a message that was closed but has since been updated', async () => {
        localStorage.setItem('bannerLastClosed_global', '2026-01-01T00:00:00Z');
        mockFetchOnce({
            global: {
                message: 'Updated message',
                severity: 'INFO',
                updated: '2026-06-01T00:00:00Z', // updated after the last closed date
                closable: true,
            },
        });
        render(<Banner bannerUrl="http://static/status.json" scope="regions"/>);
        expect(await screen.findByText('Updated message')).toBeInTheDocument();
    });
});
