/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardTables from './dashboardTables.tsx';
import { Table } from '../../api/sources/model.ts';

describe('DashboardTables', () => {
    const tables: Table[] = [
        { name: 'tableOne', rows: [{ name: 'rowA', values: [1] }] },
        { name: 'tableTwo', rows: [{ name: 'rowB', values: [2] }] },
    ];

    it('renders an option per table and the first table by default', () => {
        render(<DashboardTables tables={tables} />);

        expect(screen.getByRole('option', { name: 'tableOne' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'tableTwo' })).toBeInTheDocument();
        expect(screen.getByText('rowA')).toBeInTheDocument();
        expect(screen.queryByText('rowB')).not.toBeInTheDocument();
    });

    it('switches the displayed table when a different option is selected', () => {
        render(<DashboardTables tables={tables} />);

        fireEvent.change(screen.getByRole('combobox'), { target: { selectedIndex: 1 } });

        expect(screen.getByText('rowB')).toBeInTheDocument();
        expect(screen.queryByText('rowA')).not.toBeInTheDocument();
    });

    it('forwards the italisize prop through to the underlying DashboardTable', () => {
        const italicTables: Table[] = [
            { name: 'species', rows: [{ name: 'Genus - species', values: [1] }] },
        ];

        const { container } = render(<DashboardTables tables={italicTables} italisize={true} />);
        expect(container.querySelector('i')).toHaveTextContent('Genus');
    });
});
