/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

jest.mock('@ala/common-ui', () => {
    const React = require('react');
    return {
        __esModule: true,
        FontAwesomeIconLite: () => null,
        DualRangeSlider: () => null,
        useHashState: (_key: string, defaultValue: any) => {
            const [value, setValue] = React.useState(defaultValue);
            return [value, setValue];
        },
    };
}, { virtual: true });

jest.mock('react-leaflet', () => {
    const React = require('react');
    return {
        __esModule: true,
        MapContainer: React.forwardRef(({ children }: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({ fitBounds: jest.fn() }));
            return <div data-testid="map-container">{children}</div>;
        }),
        TileLayer: () => null,
        WMSTileLayer: (props: any) => <div data-testid="wms-layer" data-url={props.url} />,
        ScaleControl: () => null,
        LayersControl: Object.assign(({ children }: any) => <>{children}</>, {
            BaseLayer: ({ children }: any) => <>{children}</>,
        }),
    };
});

jest.mock('react-leaflet-google-layer', () => ({ __esModule: true, default: () => null }));
jest.mock('react-chartjs-2', () => ({ __esModule: true, Pie: () => <div data-testid="pie-chart" /> }));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Region from './Region';
import speciesGroupsFixture from '../../tests/resources/speciesGroups.json';
import speciesFixture from '../../tests/resources/species.json';
import kingdomsFixture from '../../tests/resources/kingdoms.json';

const env = (globalThis as any).__IMPORT_META__.env;
const SPATIAL_WS_URL = env.VITE_SPATIAL_WS_URL;
const BIOCACHE_URL = env.VITE_APP_BIOCACHE_URL;

const actObjectResponse = {
    fid: 'cl10925',
    name: 'AUSTRALIAN CAPITAL TERRITORY',
    bbox: 'POLYGON((148.762675104 -35.9207620485,148.762675104 -35.124517035,149.399284512 -35.124517035,149.399284512 -35.9207620485,148.762675104 -35.9207620485))',
    description: 'AUSTRALIAN CAPITAL TERRITORY',
};

function mockFetch(overrides: { object?: any; noFacets?: boolean } = {}) {
    (global as any).fetch = jest.fn((url: string) => {
        if (url.includes(`${SPATIAL_WS_URL}/object/`)) {
            return Promise.resolve({ json: () => Promise.resolve(overrides.object ?? actObjectResponse) });
        }
        if (url.includes(BIOCACHE_URL)) {
            const parsed = new URL(url);
            const facets = parsed.searchParams.get('facets');
            if (overrides.noFacets) {
                return Promise.resolve({
                    json: () => Promise.resolve({ totalRecords: 0, facetResults: [] }),
                });
            }
            if (facets === 'species,decade') {
                return Promise.resolve({ json: () => Promise.resolve(speciesFixture) });
            }
            if (facets === 'kingdom,decade') {
                return Promise.resolve({ json: () => Promise.resolve(kingdomsFixture) });
            }
            // speciesGroup,decade (initial fetchObject call)
            return Promise.resolve({ json: () => Promise.resolve(speciesGroupsFixture) });
        }
        return Promise.resolve({ json: () => Promise.resolve({}) });
    });
}

function renderRegion() {
    return render(<Region setBreadcrumbs={() => {}} />);
}

function setLocation(search: string) {
    window.history.pushState({}, '', search || '/');
}

describe('Region', () => {
    beforeAll(() => {
        window.open = jest.fn();
    });

    beforeEach(() => {
        // Region.tsx reads the `id` query param from location.search on mount.
        setLocation('?id=8832857');
        mockFetch();
    });

    afterEach(() => {
        jest.clearAllMocks();
        setLocation('/');
    });

    it('does not render the region content before the spatial object/biocache data arrives', () => {
        (global as any).fetch = jest.fn(() => new Promise(() => {})); // never resolves
        renderRegion();
        expect(screen.queryByText('AUSTRALIAN CAPITAL TERRITORY')).not.toBeInTheDocument();
    });

    it('renders the region name and formatted occurrence/species counts once loaded', async () => {
        renderRegion();

        await waitFor(() => {
            expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument();
        });

        // totalRecords from the fixtures is large enough to be formatted with a suffix (M or plain).
        expect(screen.getByText(/Occurrence records/)).toBeInTheDocument();
        expect(screen.getByText(/Number of species/)).toBeInTheDocument();
    });

    it('does not render the region content when the spatial object has no bbox', async () => {
        mockFetch({ object: { fid: 'cl10925', name: 'NO BBOX REGION' } });
        renderRegion();

        await new Promise(r => setTimeout(r, 20));
        expect(screen.queryByText('NO BBOX REGION')).not.toBeInTheDocument();
    });

    it('renders zero counts and "No species found" when biocache has no facet results', async () => {
        mockFetch({ noFacets: true });
        renderRegion();

        await waitFor(() => {
            expect(screen.getByText('Occurrence records (0)')).toBeInTheDocument();
        });
        expect(screen.getByText('Number of species (0)')).toBeInTheDocument();
        expect(screen.getByText('No species found')).toBeInTheDocument();
    });

    it('lists species from the biocache species facet with their counts', async () => {
        renderRegion();

        await waitFor(() => {
            expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument();
        });

        const firstSpecies = speciesFixture.facetResults[0].fieldResult[0];
        await waitFor(() => {
            expect(screen.getByText(firstSpecies.label)).toBeInTheDocument();
        });
    });

    it('selecting a species reveals the species profile and list records actions', async () => {
        renderRegion();
        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        const firstSpecies = speciesFixture.facetResults[0].fieldResult[0];
        await waitFor(() => expect(screen.getByText(firstSpecies.label)).toBeInTheDocument());

        fireEvent.click(screen.getByText(firstSpecies.label));

        await waitFor(() => {
            expect(screen.getByText('Species profile')).toBeInTheDocument();
        });
        expect(screen.getByText('List records')).toBeInTheDocument();
    });

    it('selecting a species group refetches the species list filtered to that group', async () => {
        renderRegion();
        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        const groupName = speciesGroupsFixture.facetResults[0].fieldResult[0].label;
        await waitFor(() => expect(screen.getByText(groupName)).toBeInTheDocument());

        (global.fetch as jest.Mock).mockClear();
        fireEvent.click(screen.getByText(groupName));

        await waitFor(() => {
            const calls = (global.fetch as jest.Mock).mock.calls.map((c: any[]) => c[0]);
            expect(calls.some((url: string) => url.includes(encodeURIComponent(`speciesGroup:"${groupName}"`)))).toBe(true);
        });
    });

    it('switching to the taxonomy tab renders the chart once kingdom data arrives', async () => {
        renderRegion();
        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('tab', { name: 'Explore by taxonomy' }));

        await waitFor(() => {
            expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        });
    });

    it('shows a "No data" message on the taxonomy tab when there is no facet data', async () => {
        mockFetch({ noFacets: true });
        renderRegion();
        await waitFor(() => expect(screen.getByText('Occurrence records (0)')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('tab', { name: 'Explore by taxonomy' }));

        await waitFor(() => {
            expect(screen.getByText('No data')).toBeInTheDocument();
        });
    });

    it('the WMS occurrence layer URL is empty until the spatial object has loaded', () => {
        (global as any).fetch = jest.fn(() => new Promise(() => {}));
        renderRegion();
        // While loading, the main content (including the map) is not rendered at all.
        expect(screen.queryByTestId('wms-layer')).not.toBeInTheDocument();
    });

    it('builds the occurrence WMS layer URL using the region fid and name once loaded', async () => {
        renderRegion();

        await waitFor(() => {
            expect(screen.getAllByTestId('wms-layer').length).toBeGreaterThan(0);
        });

        const wmsLayer = screen.getAllByTestId('wms-layer').find(el => el.getAttribute('data-url')?.includes('ogc/wms/reflect'));
        expect(wmsLayer?.getAttribute('data-url')).toContain(encodeURIComponent('AUSTRALIAN CAPITAL TERRITORY'));
        expect(wmsLayer?.getAttribute('data-url')).toContain('cl10925');
    });

    it('the "Previous rank" button is hidden at the top-level (kingdom) rank', async () => {
        renderRegion();
        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('tab', { name: 'Explore by taxonomy' }));

        await waitFor(() => expect(screen.getByTestId('pie-chart')).toBeInTheDocument());
        expect(screen.queryByText('Previous rank')).not.toBeInTheDocument();
    });

    it('the Alerts button opens a new tab with an alerts URL once the region is loaded', async () => {
        renderRegion();
        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Alerts'));

        expect(window.open).toHaveBeenCalledWith(expect.stringContaining('alert'), '_blank');
    });

    it('does not fetch the spatial object when there is no id query parameter', () => {
        setLocation('');
        renderRegion();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
