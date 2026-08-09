/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import RefineSection, {RefineSectionItem} from './refineSection.tsx';

describe('RefineSection', () => {
    const makeItem = (label: string, overrides: Partial<RefineSectionItem> = {}): RefineSectionItem => ({
        label,
        onClick: jest.fn(),
        isOpen: false,
        isDisabled: () => false,
        ...overrides,
    });

    it('renders the title', () => {
        render(<RefineSection title="My Title" items={[]}/>);
        expect(screen.getByText('My Title')).toBeInTheDocument();
    });

    it('renders all items when there are fewer than lessNumber', () => {
        const items = [makeItem('A'), makeItem('B')];
        render(<RefineSection title="T" items={items} lessNumber={5}/>);
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('calls onClick when an item is clicked', () => {
        const item = makeItem('A');
        render(<RefineSection title="T" items={[item]}/>);
        fireEvent.click(screen.getByText('A'));
        expect(item.onClick).toHaveBeenCalled();
    });

    it('hides items beyond lessNumber and shows a Show more control', () => {
        const items = [makeItem('A'), makeItem('B'), makeItem('C')];
        render(<RefineSection title="T" items={items} lessNumber={1}/>);
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.queryByText('B')).not.toBeInTheDocument();
        expect(screen.queryByText('C')).not.toBeInTheDocument();
        expect(screen.getByText('Show more')).toBeInTheDocument();
    });

    it('shows all items and a Show less control after clicking Show more', () => {
        const items = [makeItem('A'), makeItem('B'), makeItem('C')];
        render(<RefineSection title="T" items={items} lessNumber={1}/>);
        fireEvent.click(screen.getByText('Show more'));
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('C')).toBeInTheDocument();
        expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('hides extra items again after clicking Show less', () => {
        const items = [makeItem('A'), makeItem('B'), makeItem('C')];
        render(<RefineSection title="T" items={items} lessNumber={1}/>);
        fireEvent.click(screen.getByText('Show more'));
        fireEvent.click(screen.getByText('Show less'));
        expect(screen.queryByText('B')).not.toBeInTheDocument();
        expect(screen.getByText('Show more')).toBeInTheDocument();
    });

    it('does not show the Show more/less control when items.length <= lessNumber', () => {
        const items = [makeItem('A'), makeItem('B')];
        render(<RefineSection title="T" items={items} lessNumber={5}/>);
        expect(screen.queryByText('Show more')).not.toBeInTheDocument();
        expect(screen.queryByText('Show less')).not.toBeInTheDocument();
    });

    it('renders all items when lessNumber is not provided', () => {
        const items = [makeItem('A'), makeItem('B'), makeItem('C')];
        render(<RefineSection title="T" items={items}/>);
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('C')).toBeInTheDocument();
        expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    });

    it('supports React node labels', () => {
        const item = makeItem('unused', {label: <span data-testid="node-label">Node Label</span>});
        render(<RefineSection title="T" items={[item]}/>);
        expect(screen.getByTestId('node-label')).toBeInTheDocument();
    });
});
