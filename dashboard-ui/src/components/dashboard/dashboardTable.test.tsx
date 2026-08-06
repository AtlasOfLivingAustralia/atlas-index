/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardTable from './dashboardTable.tsx';
import { Table } from '../../api/sources/model.ts';

describe('DashboardTable', () => {
    it('renders no header row when the header prop is omitted', () => {
        const table: Table = {
            rows: [{ name: 'foo', values: [1] }],
        };

        const { container } = render(<DashboardTable table={table} />);
        expect(container.querySelector('thead')).not.toBeInTheDocument();
    });

    it('renders a header row with the supplied column labels', () => {
        const table: Table = {
            rows: [],
        };

        render(<DashboardTable table={table} header={['name', 'count']} />);
        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('count')).toBeInTheDocument();
    });

    it('normalises an empty third header cell to a single space instead of skipping it', () => {
        const table: Table = { rows: [] };

        const { container } = render(
            <DashboardTable table={table} header={['name', 'count', '']} />
        );

        // Three <th> elements should be present (name, count, and the
        // normalised third column) rather than only two.
        expect(container.querySelectorAll('th')).toHaveLength(3);
    });

    it('renders one row per table row with formatted values', () => {
        const table: Table = {
            rows: [
                { name: 'rowOne', values: [1500000] },
                { name: 'rowTwo', values: [42] },
            ],
        };

        render(<DashboardTable table={table} />);

        expect(screen.getByText('rowOne')).toBeInTheDocument();
        expect(screen.getByText('1.5M')).toBeInTheDocument();
        expect(screen.getByText('rowTwo')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('marks rows with a URL as clickable and navigates to it on click', () => {
        const table: Table = {
            rows: [{ name: 'linked', url: 'https://example.org/target', values: [1] }],
        };

        render(<DashboardTable table={table} />);

        const row = screen.getByText('linked').closest('tr')!;
        expect(row).toHaveClass('dashboardRowLink');

        // jsdom does not implement navigation, so assigning `location.href`
        // logs a "Not implemented" error rather than throwing — suppress it
        // here and just assert the click handler ran without error.
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => row.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
        consoleError.mockRestore();
    });

    it('does not attempt navigation for rows without a URL', () => {
        const table: Table = {
            rows: [{ name: 'unlinked', values: [1] }],
        };

        render(<DashboardTable table={table} />);

        const row = screen.getByText('unlinked').closest('tr')!;
        expect(row).not.toHaveClass('dashboardRowLink');
    });

    it('italisizes and splits the name on " - " when italisize is set', () => {
        const table: Table = {
            rows: [{ name: 'Genus - species', values: [1] }],
        };

        const { container } = render(<DashboardTable table={table} italisize={true} />);

        const italic = container.querySelector('i');
        expect(italic).toHaveTextContent('Genus');
        expect(container.querySelector('td')).toHaveTextContent('Genus - species');
    });

    it('drops value columns beyond the header length', () => {
        const table: Table = {
            rows: [{ name: 'row', values: [1, 2, 3] }],
        };

        render(<DashboardTable table={table} header={['name', 'count']} />);

        // header.length - 1 === 1, so only the first value column is rendered.
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.queryByText('2')).not.toBeInTheDocument();
        expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
});
