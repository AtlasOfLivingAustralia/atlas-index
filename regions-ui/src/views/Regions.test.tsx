/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

let capturedMapClickHandlers: any = null;

jest.mock('@ala/common-ui', () => {
    const React = require('react');
    return {
        __esModule: true,
        FontAwesomeIconLite: () => null,
        DualRangeSlider: () => null,
        useHashState: (key: string, defaultValue: any) => {
            const hashParams = new URLSearchParams(globalThis.window.location.hash.substring(1));
            const initial = hashParams.get(key) ?? defaultValue;
            const [value, setValue] = React.useState(initial);
            const setHashValue = (newValue: any) => {
                setValue(newValue);
                const params = new URLSearchParams(globalThis.window.location.hash.substring(1));
                if (newValue !== null && newValue !== undefined) {
                    params.set(key, String(newValue));
                } else {
                    params.delete(key);
                }
                globalThis.window.location.hash = `#${params.toString()}`;
            };
            return [value, setHashValue];
        },
    };
}, { virtual: true });

jest.mock('react-leaflet', () => {
    const React = require('react');
    return {
        __esModule: true,
        MapContainer: React.forwardRef(({ children }: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({ setView: jest.fn(), fitBounds: jest.fn() }));
            return <div data-testid="map-container">{children}</div>;
        }),
        TileLayer: () => <div data-testid="tile-layer" />,
        WMSTileLayer: (props: any) => <div data-testid="wms-layer" data-layers={props.layers} />,
        ScaleControl: () => null,
        Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
        LayersControl: Object.assign(({ children }: any) => <>{children}</>, {
            BaseLayer: ({ children }: any) => <>{children}</>,
        }),
        useMap: () => ({}),
        useMapEvents: (handlers: any) => {
            capturedMapClickHandlers = handlers;
            return {};
        },
    };
});

jest.mock('react-leaflet-google-layer', () => ({ __esModule: true, default: () => null }));

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LatLng } from 'leaflet';
import Regions from './Regions';
import regionsListFixture from '../../tests/resources/regionsList.json';

const REGIONS_CONFIG_URL = (globalThis as any).__IMPORT_META__.env.VITE_REGIONS_CONFIG_URL;
const SPATIAL_WS_URL = (globalThis as any).__IMPORT_META__.env.VITE_SPATIAL_WS_URL;

function mockFetchSequence(handlers: { match: (url: string) => boolean; response: any }[]) {
    (global as any).fetch = jest.fn((url: string) => {
        const found = handlers.find(h => h.match(url));
        return Promise.resolve({
            json: () => Promise.resolve(found ? found.response : {}),
        });
    });
}

function RegionRouteProbe() {
    return <div data-testid="region-route" />;
}

function renderRegions(initialEntries: string[] = ['/']) {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/" element={<Regions setBreadcrumbs={() => {}} />} />
                <Route path="/region" element={<RegionRouteProbe />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('Regions', () => {
    beforeAll(() => {
        // jsdom does not implement scrollTo; Regions.tsx calls it on navigation.
        window.scrollTo = jest.fn();
    });

    beforeEach(() => {
        capturedMapClickHandlers = null;
        globalThis.window.location.hash = '';
        mockFetchSequence([{ match: url => url.includes(REGIONS_CONFIG_URL), response: regionsListFixture }]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the introductory heading and instructions', async () => {
        renderRegions();
        expect(screen.getByText('Select a region to explore')).toBeInTheDocument();
        expect(screen.getByText(/Click on a region name to select an area/)).toBeInTheDocument();

        // Let the mocked regions config fetch resolve inside act() so the
        // resulting state updates don't leak past this test.
        await waitFor(() => expect(screen.getByText('States and territories')).toBeInTheDocument());
    });

    it('builds the accordion menu from the fetched regions config', async () => {
        renderRegions();

        await waitFor(() => {
            expect(screen.getByText('States and territories')).toBeInTheDocument();
        });
        expect(screen.getByText('Local government')).toBeInTheDocument();
        expect(screen.getByText('Commonwealth government')).toBeInTheDocument();
        expect(screen.getByText('Other regions')).toBeInTheDocument();
    });

    it('lists the region objects under the default (first) layer', async () => {
        renderRegions();

        await waitFor(() => {
            expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument();
        });
        expect(screen.getByText('NEW SOUTH WALES')).toBeInTheDocument();
    });

    it('selecting a region object shows it as the selected region with a Zoom to region button', async () => {
        renderRegions();

        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(screen.getByText('AUSTRALIAN CAPITAL TERRITORY'));
            // setMapObject uses a 5ms timeout before applying the new selection
            await new Promise(r => setTimeout(r, 20));
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'AUSTRALIAN CAPITAL TERRITORY' })).toBeInTheDocument();
        });
        expect(screen.getByText(/Zoom to region/)).toBeInTheDocument();
    });

    it('clicking the selected region button navigates to its region page', async () => {
        renderRegions();

        await waitFor(() => expect(screen.getByText('AUSTRALIAN CAPITAL TERRITORY')).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(screen.getByText('AUSTRALIAN CAPITAL TERRITORY'));
            await new Promise(r => setTimeout(r, 20));
        });

        const openButton = await screen.findByRole('button', { name: 'AUSTRALIAN CAPITAL TERRITORY' });
        fireEvent.click(openButton);

        await waitFor(() => {
            expect(screen.getByTestId('region-route')).toBeInTheDocument();
        });
    });

    it('pre-selects the region referenced by the URL hash on initial load', async () => {
        globalThis.window.location.hash = '#region=NEW%20SOUTH%20WALES';
        renderRegions();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'NEW SOUTH WALES' })).toBeInTheDocument();
        });
    });

    it('does nothing on map click when no layer is currently selected', async () => {
        // Delay the regions config response indefinitely so selectedLayer
        // never gets set — handleMapClick's `if (mapRef.current && selectedLayer)`
        // guard should skip the intersect fetch entirely.
        (global as any).fetch = jest.fn(() => new Promise(() => {}));

        renderRegions();
        await waitFor(() => expect(capturedMapClickHandlers).not.toBeNull());

        await act(async () => {
            await capturedMapClickHandlers.click({ latlng: new LatLng(-35.3, 149.1) });
        });

        const calls = (global.fetch as jest.Mock).mock.calls.map((c: any[]) => c[0]);
        expect(calls.some(url => url.includes('/intersect/'))).toBe(false);
    });

    it('map click intersects the selected layer and selects the returned region', async () => {
        mockFetchSequence([
            { match: url => url.includes(REGIONS_CONFIG_URL), response: regionsListFixture },
            {
                match: url => url.includes(`${SPATIAL_WS_URL}/intersect/`),
                response: [{ pid: '999', value: 'TEST REGION' }],
            },
            {
                match: url => url.includes(`${SPATIAL_WS_URL}/object/`),
                response: { bbox: 'POLYGON((148.0 -35.0,148.0 -34.0,149.0 -34.0,149.0 -35.0,148.0 -35.0))', description: 'a test region' },
            },
        ]);

        renderRegions();
        await waitFor(() => expect(capturedMapClickHandlers).not.toBeNull());
        // the default layer is already selected once menu items load; setMapObject
        // applies the selection after an internal 5ms timeout, so wait for the
        // resulting WMS layer (not just the menu text) before clicking the map.
        await waitFor(() => expect(screen.getAllByTestId('wms-layer').length).toBeGreaterThan(0));

        await act(async () => {
            await capturedMapClickHandlers.click({ latlng: new LatLng(-35.3, 149.1) });
        });

        await waitFor(
            () => {
                expect(screen.getByRole('button', { name: 'TEST REGION' })).toBeInTheDocument();
            },
            { timeout: 2000 }
        );
    });

    it('the Reset map button becomes enabled once the default layer auto-selects on load', async () => {
        renderRegions();
        await waitFor(() => expect(screen.getByText('States and territories')).toBeInTheDocument());
        // setMapObject (called for the initial default layer) always marks the
        // map state as changed, so Reset map is enabled as soon as loading completes.
        await waitFor(() => expect(screen.getByRole('button', { name: /Reset/ })).not.toBeDisabled());
    });

    it('renders the "Other regions" layer using its fields (not objects)', async () => {
        renderRegions();
        await waitFor(() => expect(screen.getByText('Other regions')).toBeInTheDocument());
        expect(screen.getByText('Great Eastern Ranges Initiative')).toBeInTheDocument();
    });
});
