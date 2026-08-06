/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Home from './Home.tsx';
import collectionsData from '../api/sources/collections.json';

describe('Home', () => {
    it('sets the breadcrumbs on mount', () => {
        const setBreadcrumbs = jest.fn();
        render(
            <MemoryRouter>
                <Home setBreadcrumbs={setBreadcrumbs} />
            </MemoryRouter>
        );

        expect(setBreadcrumbs).toHaveBeenCalledWith([
            { title: 'Home', href: 'https://ala.org.au' },
            {
                title: 'Images of specimens | Atlas of Living Australia',
                href: '',
            },
        ]);
    });

    it('renders a card for every collection in collections.json', () => {
        render(
            <MemoryRouter>
                <Home setBreadcrumbs={jest.fn()} />
            </MemoryRouter>
        );

        const links = screen.getAllByRole('link', {
            name: collectionsData[0].name,
        });
        expect(links.length).toBeGreaterThan(0);

        // one heading link per collection (name appears as an h2 link)
        const headings = screen.getAllByRole('heading', { level: 2 });
        expect(headings.length).toBe(collectionsData.length);
    });

    it('links each collection card to /browse/:uid', () => {
        render(
            <MemoryRouter>
                <Home setBreadcrumbs={jest.fn()} />
            </MemoryRouter>
        );

        const firstCollection = collectionsData[0];
        const nameLinks = screen.getAllByRole('link', {
            name: firstCollection.name,
        });
        expect(nameLinks[0]).toHaveAttribute(
            'href',
            `/browse/${firstCollection.uid}`
        );
    });

    it('renders the institution name when present', () => {
        render(
            <MemoryRouter>
                <Home setBreadcrumbs={jest.fn()} />
            </MemoryRouter>
        );

        const withInstitution = collectionsData.find((c) => c.institution);
        const institutionName = withInstitution?.institution?.name;
        if (institutionName) {
            expect(screen.getByText(institutionName)).toBeInTheDocument();
        }
    });

    it('includes a link to browse all collections', () => {
        render(
            <MemoryRouter>
                <Home setBreadcrumbs={jest.fn()} />
            </MemoryRouter>
        );

        const browseAllLink = screen.getByRole('link', {
            name: 'click here',
        });
        expect(browseAllLink).toHaveAttribute('href', '/browse');
    });
});
