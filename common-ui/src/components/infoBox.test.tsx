/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {faStar} from '@fortawesome/free-solid-svg-icons';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import InfoBox from './infoBox.tsx';

describe('InfoBox', () => {
    it('renders the title and content', () => {
        render(<InfoBox icon={faStar} title="My Title" content="My Content"/>);
        expect(screen.getByText('My Title')).toBeInTheDocument();
        expect(screen.getByText('My Content')).toBeInTheDocument();
    });

    it('renders an icon svg', () => {
        const {container} = render(<InfoBox icon={faStar} title="Title" content="Content"/>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies the className to the top wrapper div', () => {
        const {container} = render(<InfoBox icon={faStar} title="Title" content="Content" className="my-class"/>);
        expect(container.querySelector('.my-class')).toBeInTheDocument();
    });

    it('applies custom size and lineHeight to the content div', () => {
        render(<InfoBox icon={faStar} title="Title" content="Content" size={24} lineHeight={30}/>);
        const content = screen.getByText('Content');
        expect(content).toHaveStyle({fontSize: '24px', lineHeight: '30px'});
    });

    it('applies custom style to the top wrapper div', () => {
        const {container} = render(<InfoBox icon={faStar} title="Title" content="Content" style={{marginTop: '5px'}}/>);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle({marginTop: '5px'});
    });

    it('renders React node content', () => {
        render(<InfoBox icon={faStar} title="Title" content={<span data-testid="node">Node content</span>}/>);
        expect(screen.getByTestId('node')).toBeInTheDocument();
    });
});
