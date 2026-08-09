/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import Legend from './mapLegend.tsx';

describe('Legend', () => {
    // The component always indexes legendEntries[0] and legendEntries[4]
    // when building the gradient background, so every test must supply at
    // least 5 hex bin values.
    const fiveEntries: [string, number | null][] = [
        ['ff0000ff', 10],
        ['00ff00ff', 20],
        ['0000ffff', 30],
        ['ffff00ff', 40],
        ['ff00ffff', 50],
    ];

    it('renders an upper bound label for each hex bin value', () => {
        render(<Legend fillOpacity={0.5} hexBinValues={fiveEntries} />);
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('renders the "Number of species records" title', () => {
        render(<Legend fillOpacity={1} hexBinValues={fiveEntries} />);
        expect(screen.getByText('Number of species records')).toBeInTheDocument();
    });

    it('handles a null count by grouping it under the computed max count', () => {
        const hexBinValues: [string, number | null][] = [
            ['ff0000ff', 5],
            ['00ff00ff', null],
            ['0000ffff', 15],
            ['ffff00ff', 20],
            ['ff00ffff', 25],
        ];
        // maxCount = max(5, 0, 15, 20, 25) * 10 = 250
        render(<Legend fillOpacity={0.5} hexBinValues={hexBinValues} />);
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('limits the number of legend entries to maxGridCount (5)', () => {
        const hexBinValues: [string, number | null][] = [
            ['ff0000ff', 1],
            ['ff0000ff', 2],
            ['ff0000ff', 3],
            ['ff0000ff', 4],
            ['ff0000ff', 5],
            ['ff0000ff', 6],
            ['ff0000ff', 7],
        ];
        const {container} = render(<Legend fillOpacity={0.5} hexBinValues={hexBinValues} />);
        const labels = container.querySelectorAll('.map-legend-label');
        expect(labels.length).toBe(5);
    });

    it('strips the alpha channel from the hex colour when building the gradient background', () => {
        const {container} = render(
            <Legend fillOpacity={0.5} hexBinValues={fiveEntries} />
        );
        const gradientDiv = container.querySelector('.row.justify-content-around') as HTMLElement;
        expect(gradientDiv.style.background).toContain('#ff0000');
        expect(gradientDiv.style.background).not.toContain('#ff0000ff');
    });

    it('applies the fillOpacity to the gradient container', () => {
        const {container} = render(
            <Legend fillOpacity={0.42} hexBinValues={fiveEntries} />
        );
        const gradientDiv = container.querySelector('.row.justify-content-around') as HTMLElement;
        expect(gradientDiv.style.opacity).toBe('0.42');
    });
});
