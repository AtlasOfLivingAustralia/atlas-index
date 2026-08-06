/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GridCard from './gridCard.tsx';

describe('GridCard', () => {
    it('renders the header and children', () => {
        render(
            <GridCard header={<span>My Header</span>}>
                <div>My Content</div>
            </GridCard>
        );

        expect(screen.getByText('My Header')).toBeInTheDocument();
        expect(screen.getByText('My Content')).toBeInTheDocument();
    });

    it('renders headerNum alongside the header when provided', () => {
        render(
            <GridCard headerNum={42} header={<span>Records</span>}>
                <div>Content</div>
            </GridCard>
        );

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('42 Records');
    });

    it('omits headerNum text when not provided', () => {
        render(
            <GridCard header={<span>Records</span>}>
                <div>Content</div>
            </GridCard>
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Records');
    });
});
