/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import NotFound from './notFound.tsx';

describe('NotFound', () => {
    it('renders the not found heading', () => {
        render(<NotFound/>);
        expect(screen.getByRole('heading', {name: 'Page Not Found'})).toBeInTheDocument();
    });

    it('renders the helpful message text', () => {
        render(<NotFound/>);
        expect(screen.getByText('The page you are looking for does not exist.')).toBeInTheDocument();
        expect(screen.getByText('Please check the URL or return to the homepage.')).toBeInTheDocument();
    });
});
