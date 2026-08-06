/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import Breadcrumbs from './breadcrumbs.tsx';

describe('Breadcrumbs', () => {
    it('renders a link for non-last items with an href', () => {
        render(<Breadcrumbs breadcrumbs={[
            {title: 'Home', href: '/'},
            {title: 'Current', href: null},
        ]}/>);
        const link = screen.getByRole('link', {name: 'Home'});
        expect(link).toHaveAttribute('href', '/');
    });

    it('does not render a link for the last item even if it has an href', () => {
        render(<Breadcrumbs breadcrumbs={[
            {title: 'Home', href: '/'},
            {title: 'Current', href: '/current'},
        ]}/>);
        expect(screen.queryByRole('link', {name: 'Current'})).not.toBeInTheDocument();
        expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('does not render a link for items without an href', () => {
        render(<Breadcrumbs breadcrumbs={[
            {title: 'NoLink', href: undefined},
            {title: 'Current', href: null},
        ]}/>);
        expect(screen.queryByRole('link', {name: 'NoLink'})).not.toBeInTheDocument();
        expect(screen.getByText('NoLink')).toBeInTheDocument();
    });

    it('renders the correct number of breadcrumb items', () => {
        const {container} = render(<Breadcrumbs breadcrumbs={[
            {title: 'A', href: '/a'},
            {title: 'B', href: '/b'},
            {title: 'C', href: null},
        ]}/>);
        expect(container.querySelectorAll('li.breadcrumb-item').length).toBe(3);
    });

    it('renders an empty list when no breadcrumbs are provided', () => {
        const {container} = render(<Breadcrumbs breadcrumbs={[]}/>);
        expect(container.querySelectorAll('li.breadcrumb-item').length).toBe(0);
    });

    it('supports React node titles', () => {
        render(<Breadcrumbs breadcrumbs={[
            {title: <span data-testid="node-title">Node</span>, href: null},
        ]}/>);
        expect(screen.getByTestId('node-title')).toBeInTheDocument();
    });
});
