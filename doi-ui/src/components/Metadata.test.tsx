/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Metadata from './Metadata';

describe('Metadata', () => {
    it('renders default template with description, licence and additional metadata', () => {
        const data = {
            description: 'A test description',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0', 'CC0'],
            applicationMetadata: { foo: 'bar', nested: { baz: 'qux' } },
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('A test description')).toBeInTheDocument();
        expect(screen.getByText('2 licences')).toBeInTheDocument();
        expect(screen.getByText('CC BY 4.0')).toBeInTheDocument();
        expect(screen.getByText('CC0')).toBeInTheDocument();
        // renderMetadata recurses into the object keys, converting camelCase to spaced/capitalised labels
        expect(screen.getByText('Foo:')).toBeInTheDocument();
        expect(screen.getByText('Nested:')).toBeInTheDocument();
        expect(screen.getByText('Baz:')).toBeInTheDocument();
        expect(screen.getByText('bar')).toBeInTheDocument();
        expect(screen.getByText('qux')).toBeInTheDocument();
    });

    it('default template renders customLandingPageUrl link when present', () => {
        const data = {
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            customLandingPageUrl: 'https://example.com/landing',
            applicationMetadata: null,
        };

        render(<Metadata data={data} isMobile={false} />);

        const link = screen.getByRole('link', { name: /View the application landing page/i });
        expect(link).toHaveAttribute('href', 'https://example.com/landing');
    });

    it('default template renders formatted fileSize when present', () => {
        const data = {
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            fileSize: 1048576, // 1 MiB
            applicationMetadata: null,
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('1.00 MiB')).toBeInTheDocument();
    });

    it('default template renders fileHash as hex string when present', () => {
        const data = {
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            fileHash: new Uint8Array([0, 255, 16]).buffer,
            applicationMetadata: null,
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('00ff10')).toBeInTheDocument();
    });

    it('does not crash when applicationMetadata is null (renderMetadata(null))', () => {
        const data = {
            description: 'desc',
            dateCreated: '2025-01-01T00:00:00Z',
            licence: ['CC BY 4.0'],
            applicationMetadata: null,
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('Additional')).toBeInTheDocument();
    });

    it('renders biocache template with record count, filename and search query params', () => {
        const data = {
            displayTemplate: 'biocache',
            dateCreated: '2025-01-01T00:00:00Z',
            filename: 'occurrence-download.zip',
            doi: '10.1/test-doi',
            licence: ['CC BY 4.0'],
            applicationMetadata: {
                recordCount: 42,
                searchUrl: 'https://biocache.test.ala.org.au/occurrences/search?q=Acacia&disableAllQualityFilters=true',
                queryTitle: 'Acacia',
                qualityFilters: [],
                datasets: [],
            },
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('42')).toBeInTheDocument();
        // "disableAllQualityFilters" param is filtered out of the rendered query params list
        expect(screen.queryByText(/disableAllQualityFilters/)).not.toBeInTheDocument();
        expect(screen.getByText(/q:/)).toBeInTheDocument();
    });

    it('biocache template renders filename as a link when download callback provided, otherwise plain text', () => {
        const data = {
            displayTemplate: 'biocache',
            dateCreated: '2025-01-01T00:00:00Z',
            filename: 'restricted.zip',
            doi: '10.1/restricted',
            licence: ['CC BY 4.0'],
            applicationMetadata: {
                recordCount: 1,
                searchUrl: '',
                queryTitle: '',
                qualityFilters: [],
                datasets: [],
            },
        };

        const { rerender } = render(<Metadata data={data} isMobile={false} />);
        // No download callback -> plain text with insufficient permissions title
        const span = screen.getByTitle('Insufficient permissions');
        expect(span).toHaveTextContent('restricted.zip');

        const download = jest.fn();
        rerender(<Metadata data={data} isMobile={false} download={download} />);
        const link = screen.getByRole('link', { name: 'restricted.zip' });
        link.click();
        expect(download).toHaveBeenCalled();
    });

    it('biocache template renders dataProfile and quality filter descriptions when present', () => {
        const data = {
            displayTemplate: 'biocache',
            dateCreated: '2025-01-01T00:00:00Z',
            filename: 'file.zip',
            doi: '10.1/profile',
            licence: ['CC BY 4.0'],
            applicationMetadata: {
                recordCount: 5,
                searchUrl: 'https://biocache.test.ala.org.au/occurrences/search?q=Acacia',
                queryTitle: 'Acacia',
                dataProfile: 'ALA General',
                qualityFilters: [
                    { filter: 'hasCoordinate:true', description: 'Has coordinates' },
                    { filter: 'hasImage:true', description: '' },
                ],
                datasets: [],
            },
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('ALA General')).toBeInTheDocument();
        expect(screen.getByText('Has coordinates')).toBeInTheDocument();
        // falls back to filter key when description is empty
        expect(screen.getByText('hasImage:true')).toBeInTheDocument();
    });

    it('renders csdm template with application, modeller and organisation fields', () => {
        const data = {
            displayTemplate: 'csdm',
            dateCreated: '2025-01-01T00:00:00Z',
            filename: 'model.zip',
            doi: '10.1/csdm-doi',
            licence: ['CC BY 4.0'],
            authors: 'Jane Doe',
            applicationMetadata: {
                applicationName: 'Species Distribution Model',
                modeller: 'Jane Doe',
                organisation: 'ALA',
                dataSetAnnotation: 'annotation',
                workflowAnnotation: 'workflow',
                recordCount: 100,
                searchUrl: '',
            },
        };

        render(<Metadata data={data} isMobile={false} />);

        expect(screen.getByText('Species Distribution Model')).toBeInTheDocument();
        expect(screen.getByText('ALA')).toBeInTheDocument();
        expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    });

    it('csdm template invokes download callback when the file link is clicked', () => {
        const download = jest.fn();
        const data = {
            displayTemplate: 'csdm',
            dateCreated: '2025-01-01T00:00:00Z',
            filename: 'model.zip',
            doi: '10.1/csdm-doi',
            licence: ['CC BY 4.0'],
            authors: 'Jane Doe',
            applicationMetadata: {
                applicationName: 'App',
                modeller: 'Modeller',
                organisation: 'Org',
                dataSetAnnotation: '',
                workflowAnnotation: '',
                recordCount: 1,
                searchUrl: '',
            },
        };

        render(<Metadata data={data} isMobile={false} download={download} />);

        screen.getByText('model.zip').click();
        expect(download).toHaveBeenCalled();
    });
});
