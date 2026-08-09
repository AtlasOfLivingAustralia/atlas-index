import { Page } from '@playwright/test';
import { createCanvas } from 'canvas';

/** Generate a small placeholder PNG for OSM / WMS map tiles. */
async function generateTilePlaceholder(width: number = 256, height: number = 256): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(196, 77, 52, 0.25)';
    ctx.fillRect(0, 0, width, height);
    return canvas.toBuffer('image/png');
}

/** Generate a mock occurrence image with a text overlay identifying the image id. */
async function generateOccurrenceImage(imageId: string, width: number = 400, height: number = 300): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#4E7A51');
    gradient.addColorStop(0.5, '#7FA37A');
    gradient.addColorStop(1, '#C7D9B8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2E4A30';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(10, height - 44, width - 20, 34);
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Occurrence image: ${imageId}`, width / 2, height - 27);

    return canvas.toBuffer('image/png');
}

/**
 * Mock OSM tile requests (VITE_OPENSTREETMAP_ZXY_URL). Required on EVERY test that
 * loads a page containing a Leaflet <MapContainer> -- which, because
 * react-bootstrap's <Tabs> defaults to mountOnEnter=false, includes the Home page
 * ("/"), since OccurrenceSearch.tsx's Spatial-search tab map mounts immediately
 * regardless of which tab is active. Registered at browser-CONTEXT level.
 */
export async function mockOsmTiles(page: Page, seenUrls: Set<URL>) {
    const pattern = 'https://spatial.ala.org.au/osm/**';
    seenUrls.add(new URL('https://spatial.ala.org.au/osm/'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        try {
            const buffer = await generateTilePlaceholder();
            await route.fulfill({ status: 200, contentType: 'image/png', body: buffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating tile: ${error}` });
        }
    });
}

/**
 * Mock biocache-ws WMS heatmap tiles (mapView.tsx's results Map tab, ExploreYourArea's
 * WMS overlay). Not required by the Home-page/simple-search-results smoke tests
 * (Map tab is lazy-loaded and only fetches once selected), but registered here for
 * the Map-tab tests planned in PLAYWRIGHT_TEST.md.
 */
export async function mockWmsTiles(page: Page, seenUrls: Set<URL>) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/ogc/wms/reflect**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/ogc/wms/reflect'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        try {
            const buffer = await generateTilePlaceholder();
            await route.fulfill({ status: 200, contentType: 'image/png', body: buffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating tile: ${error}` });
        }
    });
}

/**
 * Mock image-service thumbnail/proxy requests (VITE_APP_IMAGE_SERVICE_URL).
 * Not required by today's smoke tests (Record images tab is lazy-loaded); provided
 * up front since the canvas machinery is already needed for map tiles above, and
 * the Records/Occurrence-detail image tests planned in PLAYWRIGHT_TEST.md will need it.
 */
export async function mockImages(page: Page, seenUrls: Set<URL>) {
    const pattern = 'https://images.test.ala.org.au/**';
    seenUrls.add(new URL('https://images.test.ala.org.au/'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const imageId = url.searchParams.get('imageId') || url.pathname.split('/').pop() || 'unknown';
        try {
            const imageBuffer = await generateOccurrenceImage(imageId);
            await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating image for ${imageId}: ${error}` });
        }
    });
}

export { generateTilePlaceholder, generateOccurrenceImage };
