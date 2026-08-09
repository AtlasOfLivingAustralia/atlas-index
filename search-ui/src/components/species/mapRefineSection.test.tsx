/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// @ala/common-ui has no CJS "require" export condition, so it can't be
// resolved directly by jest; mock it with a lightweight stand-in for
// RefineSection that renders each item's label and lets us trigger onClick.
jest.mock('@ala/common-ui', () => ({
    __esModule: true,
    RefineSection: ({title, items}: {title: string; items: {label: React.ReactNode; onClick: () => void; isOpen: boolean}[]}) => (
        <div data-testid="refine-section">
            <span>{title}</span>
            {items.map((item, idx) => (
                <div key={idx} data-testid={`refine-item-${idx}`} data-open={item.isOpen} onClick={item.onClick}>
                    {item.label}
                </div>
            ))}
        </div>
    ),
}), {virtual: true});

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import MapRefineSection, {MapDistribution} from './mapRefineSection.tsx';

describe('MapRefineSection', () => {
    const baseProps = {
        showOccurrences: true,
        onToggleOccurrences: jest.fn(),
        distributions: [] as MapDistribution[],
        onToggleDistribution: jest.fn(),
        collectionsUrl: 'https://collections.example.org',
        noDistributionsLabel: 'this species',
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the "Refine map" title', () => {
        render(<MapRefineSection {...baseProps} />);
        expect(screen.getByText('Refine map')).toBeInTheDocument();
    });

    it('shows the "no distributions" message when the distributions list is empty', () => {
        render(<MapRefineSection {...baseProps} />);
        const message = screen.getByText(/No expert distribution maps available for/);
        expect(message).toBeInTheDocument();
        expect(message.textContent).toContain('this species');
    });

    it('does not show the "no distributions" message when distributions are present', () => {
        const distributions: MapDistribution[] = [
            {geomIdx: '1', dataResourceUid: 'dr1', areaName: 'Area 1', dataResourceName: 'Resource 1'},
        ];
        render(<MapRefineSection {...baseProps} distributions={distributions} />);
        expect(screen.queryByText(/No expert distribution maps available for/)).not.toBeInTheDocument();
    });

    it('calls onToggleOccurrences when the occurrence records item is clicked', () => {
        render(<MapRefineSection {...baseProps} />);
        fireEvent.click(screen.getByText('Occurrence records'));
        expect(baseProps.onToggleOccurrences).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleDistribution with the correct index when a distribution item is clicked', () => {
        const distributions: MapDistribution[] = [
            {geomIdx: '1', dataResourceUid: 'dr1', areaName: 'Area 1', dataResourceName: 'Resource 1'},
            {geomIdx: '2', dataResourceUid: 'dr2', areaName: 'Area 2', dataResourceName: 'Resource 2'},
        ];
        render(<MapRefineSection {...baseProps} distributions={distributions} />);
        fireEvent.click(screen.getByTestId('refine-item-2'));
        expect(baseProps.onToggleDistribution).toHaveBeenCalledWith(1);
    });

    it('links to the collections page using the dataResourceUid when present', () => {
        const distributions: MapDistribution[] = [
            {geomIdx: '1', dataResourceUid: 'dr1', areaName: 'Area 1', dataResourceName: 'Resource 1'},
        ];
        render(<MapRefineSection {...baseProps} distributions={distributions} />);
        const link = screen.getByText('Resource 1').closest('a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('https://collections.example.org/public/show/dr1');
    });

    it('falls back to a "#" link when dataResourceUid is missing', () => {
        const distributions: MapDistribution[] = [
            {geomIdx: '1', dataResourceUid: '', areaName: 'Area 1', dataResourceName: 'Resource 1'},
        ];
        render(<MapRefineSection {...baseProps} distributions={distributions} />);
        const link = screen.getByText('Resource 1').closest('a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('#');
    });

    it('does not render the "Options" cached-map toggle when onToggleCachedMap is not provided', () => {
        render(<MapRefineSection {...baseProps} />);
        expect(screen.queryByText('Options')).not.toBeInTheDocument();
        expect(screen.queryByText('Enable interactive map')).not.toBeInTheDocument();
    });

    it('renders the "Options" cached-map toggle when onToggleCachedMap is provided', () => {
        render(<MapRefineSection {...baseProps} onToggleCachedMap={jest.fn()} showCachedMap={true} />);
        expect(screen.getByText('Options')).toBeInTheDocument();
        expect(screen.getByText('Enable interactive map')).toBeInTheDocument();
    });

    it('checks the "Enable interactive map" checkbox when showCachedMap is false', () => {
        render(<MapRefineSection {...baseProps} onToggleCachedMap={jest.fn()} showCachedMap={false} />);
        const checkbox = screen.getByLabelText('Enable interactive map') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('unchecks the "Enable interactive map" checkbox when showCachedMap is true', () => {
        render(<MapRefineSection {...baseProps} onToggleCachedMap={jest.fn()} showCachedMap={true} />);
        const checkbox = screen.getByLabelText('Enable interactive map') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
    });

    it('calls onToggleCachedMap with the toggled value when the checkbox changes', () => {
        const onToggleCachedMap = jest.fn();
        render(<MapRefineSection {...baseProps} onToggleCachedMap={onToggleCachedMap} showCachedMap={true} />);
        const checkbox = screen.getByLabelText('Enable interactive map');
        fireEvent.click(checkbox);
        expect(onToggleCachedMap).toHaveBeenCalledWith(false);
    });
});
