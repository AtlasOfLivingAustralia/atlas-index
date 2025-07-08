/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render} from '@testing-library/react';
import FontAwesomeIconLite from './fontAwesomeIconLite.tsx';
import '@testing-library/jest-dom';
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'

describe('FontAwesomeIconLite', () => {
    const mockClassName = 'test-icon';
    const mockIcon = faChevronRight;

    it('renders the SVG element', () => {
        render(<FontAwesomeIconLite icon={mockIcon}/>);
        const svgElements = document.querySelectorAll('svg');
        expect(svgElements.length).toBe(1);
    });

    it('sets the correct class name', () => {
        render(<FontAwesomeIconLite icon={mockIcon} className={mockClassName}/>);
        const svgElement = document.querySelector('svg');
        expect(svgElement).toHaveClass(mockClassName);
    });

    it('sets the correct viewBox attribute', () => {
        render(<FontAwesomeIconLite icon={mockIcon}/>);
        const svgElement = document.querySelector('svg');
        expect(svgElement).toHaveAttribute('viewBox', `0 0 ${mockIcon.icon[0]} ${mockIcon.icon[1]}`);
    });

    it('renders the path element with correct fill color and d attribute', () => {
        render(<FontAwesomeIconLite icon={mockIcon}/>);
        const pathElement = document.querySelector('svg')?.querySelector('path');
        expect(pathElement).toBeInTheDocument();
        expect(pathElement).toHaveAttribute('fill', 'currentColor');
        expect(pathElement).toHaveAttribute('d', mockIcon.icon[4]);
    });
});

