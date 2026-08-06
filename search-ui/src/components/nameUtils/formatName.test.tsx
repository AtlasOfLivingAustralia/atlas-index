/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import FormatName from './formatName.tsx';

describe('FormatName', () => {
    it('renders in italics when rankId is within the species/genus range (lower bound 6000)', () => {
        render(<FormatName name="Dromaius novaehollandiae" rankId={6000} />);
        const el = screen.getByText('Dromaius novaehollandiae');
        expect(el.tagName).toBe('SPAN');
        expect(el).toHaveStyle({fontStyle: 'italic'});
    });

    it('renders in italics when rankId is within the range (upper bound 8000)', () => {
        render(<FormatName name="Aves" rankId={8000} />);
        const el = screen.getByText('Aves');
        expect(el).toHaveStyle({fontStyle: 'italic'});
    });

    it('renders in italics for a rankId in the middle of the range', () => {
        render(<FormatName name="Gymnorhina" rankId={7000} />);
        expect(screen.getByText('Gymnorhina')).toHaveStyle({fontStyle: 'italic'});
    });

    it('does not italicize when rankId is just below the range (5999)', () => {
        render(<FormatName name="Aves" rankId={5999} />);
        const el = screen.getByText('Aves');
        expect(el.style.fontStyle).not.toBe('italic');
    });

    it('does not italicize when rankId is just above the range (8001)', () => {
        render(<FormatName name="Animalia" rankId={8001} />);
        const el = screen.getByText('Animalia');
        expect(el.style.fontStyle).not.toBe('italic');
    });

    it('does not italicize when rankId is 0 (falsy)', () => {
        render(<FormatName name="Unranked" rankId={0} />);
        const el = screen.getByText('Unranked');
        expect(el.style.fontStyle).not.toBe('italic');
    });

    it('renders the provided name text regardless of rank', () => {
        render(<FormatName name="Some Name" rankId={100} />);
        expect(screen.getByText('Some Name')).toBeInTheDocument();
    });
});
