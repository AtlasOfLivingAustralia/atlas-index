/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// namesView.tsx pulls in disambiguationView.tsx which reads import.meta.env
// (not parseable by babel-jest) and @ala/common-ui (which has no CJS
// "require" export condition), so both are mocked out here. This test
// focuses on the dedup/sort logic and common/indigenous name splitting,
// which are not exercised by tests/synthetic/species/NamesView.spec.ts
// (that Playwright spec only covers the "no source -> plain text" branch).
jest.mock('../../css/nameFormatting.css', () => ({}), {virtual: true});
jest.mock('@ala/common-ui', () => ({
    __esModule: true,
    InfoBox: ({title}: {title: string}) => <div data-testid="info-box">{title}</div>,
}), {virtual: true});
jest.mock('./disambiguationView.tsx', () => ({
    __esModule: true,
    default: () => <div data-testid="disambiguation-view" />,
}));

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import NamesView from './namesView.tsx';

describe('NamesView', () => {
    it('renders the accepted name and dataset link', () => {
        const result = {
            nameFormatted: '<i>Dromaius novaehollandiae</i>',
            datasetName: 'AFD',
            source: 'https://example.org/afd',
        };
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.getByText('Scientific names')).toBeInTheDocument();
        expect(screen.getByText('AFD')).toBeInTheDocument();
    });

    it('falls back to alphabetical-by-formatted-name when no namePublishedInYear is available', () => {
        const result = {
            nameFormatted: 'Accepted',
            synonymData: [
                {nameFormatted: 'Zebra synonym', datasetName: 'AFD', source: 'x'},
                {nameFormatted: 'Alpha synonym', datasetName: 'AFD', source: 'x'},
            ],
        };
        render(<NamesView result={result} isMobile={false} />);
        const cells = screen.getAllByText(/synonym/);
        expect(cells[0].textContent).toBe('Alpha synonym');
        expect(cells[1].textContent).toBe('Zebra synonym');
    });

    it('sorts synonyms most-recent-first by the structured namePublishedInYear field', () => {
        const result = {
            nameFormatted: 'Accepted',
            synonymData: [
                {nameFormatted: 'Older synonym', datasetName: 'AFD', source: 'x', namePublishedInYear: '1852'},
                {nameFormatted: 'Newer synonym', datasetName: 'AFD', source: 'x', namePublishedInYear: '1910'},
                {nameFormatted: 'No year synonym', datasetName: 'AFD', source: 'x'},
            ],
        };
        render(<NamesView result={result} isMobile={false} />);
        const cells = screen.getAllByText(/synonym/);
        expect(cells[0].textContent).toBe('Newer synonym');
        expect(cells[1].textContent).toBe('Older synonym');
        expect(cells[2].textContent).toBe('No year synonym');
    });

    it('deduplicates identifiers with the same guid/nameAccordingTo/namePublishedIn/datasetName', () => {
        const result = {
            nameFormatted: 'Accepted',
            identifierData: [
                {guid: 'urn:lsid:dup', datasetName: 'AFD'},
                {guid: 'urn:lsid:dup', datasetName: 'AFD'},
                {guid: 'urn:lsid:unique', datasetName: 'AFD'},
            ],
        };
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.getAllByText('urn:lsid:dup')).toHaveLength(1);
        expect(screen.getByText('urn:lsid:unique')).toBeInTheDocument();
    });

    it('deduplicates common names with the same name/nameAccordingTo/namePublishedIn/datasetName', () => {
        const result = {
            nameFormatted: 'Accepted',
            vernacularData: [
                {name: 'Emu', status: 'common', datasetName: 'AFD'},
                {name: 'Emu', status: 'common', datasetName: 'AFD'},
                {name: 'Ostrich', status: 'common', datasetName: 'AFD'},
            ],
        };
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.getByText('Common names')).toBeInTheDocument();
        expect(screen.getAllByText('Emu')).toHaveLength(1);
        expect(screen.getByText('Ostrich')).toBeInTheDocument();
    });

    it('splits vernacularData into common names and indigenous (traditionalKnowledge) names', () => {
        const result = {
            nameFormatted: 'Accepted',
            vernacularData: [
                {name: 'Common One', status: 'common', datasetName: 'AFD'},
                {name: 'Indigenous One', status: 'traditionalKnowledge', datasetName: 'AFD'},
            ],
        };
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.getByText('Common names')).toBeInTheDocument();
        expect(screen.getByText('Indigenous names')).toBeInTheDocument();
        expect(screen.getByText('Common One')).toBeInTheDocument();
        expect(screen.getByText('Indigenous One')).toBeInTheDocument();
    });

    it('does not render the "Common names" or "Indigenous names" sections when vernacularData is absent', () => {
        const result = {nameFormatted: 'Accepted'};
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.queryByText('Common names')).not.toBeInTheDocument();
        expect(screen.queryByText('Indigenous names')).not.toBeInTheDocument();
    });

    it('does not render the synonyms/variants/identifiers tables when their data is absent', () => {
        const result = {nameFormatted: 'Accepted'};
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.queryByText('Synonyms')).not.toBeInTheDocument();
        expect(screen.queryByText('Variants')).not.toBeInTheDocument();
        expect(screen.queryByText('Identifiers')).not.toBeInTheDocument();
    });

    it('renders the DisambiguationView child component', () => {
        const result = {nameFormatted: 'Accepted'};
        render(<NamesView result={result} isMobile={false} />);
        expect(screen.getByTestId('disambiguation-view')).toBeInTheDocument();
    });

    it('handles an undefined result without crashing', () => {
        render(<NamesView result={undefined} isMobile={true} />);
        expect(screen.getByText('Scientific names')).toBeInTheDocument();
    });
});
