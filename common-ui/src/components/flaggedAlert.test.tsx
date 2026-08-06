/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import FlaggedAlert from './flaggedAlert.tsx';

describe('FlaggedAlert', () => {
    it('renders the content', () => {
        render(<FlaggedAlert content="Some flagged content"/>);
        expect(screen.getByText('Some flagged content')).toBeInTheDocument();
    });

    it('renders a flag icon svg', () => {
        const {container} = render(<FlaggedAlert content="Content"/>);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies the className to the wrapper div', () => {
        const {container} = render(<FlaggedAlert content="Content" className="custom-class"/>);
        expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('applies the custom style along with defaults to the wrapper div', () => {
        const {container} = render(<FlaggedAlert content="Content" style={{marginTop: '20px'}}/>);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle({backgroundColor: '#FFC557', marginTop: '20px'});
    });

    it('renders React node content', () => {
        render(<FlaggedAlert content={<span data-testid="node">Node</span>}/>);
        expect(screen.getByTestId('node')).toBeInTheDocument();
    });
});
