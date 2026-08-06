import {Page} from "@playwright/test";
import {createCanvas} from "canvas";

// Function to get decimal degrees for the four corners of a tile
function getTileCorners(
    x: number,
    y: number,
    z: number
): {
    topLeft: { lat: number; lon: number };
    topRight: { lat: number; lon: number };
    bottomLeft: { lat: number; lon: number };
    bottomRight: { lat: number; lon: number };
} {
    const lonLeft = tileToLong(x, z);
    const latTop = tileToLat(y, z);
    const lonRight = tileToLong(x + 1, z);
    const latBottom = tileToLat(y + 1, z); // Latitude of the top edge of the tile below

    return {
        topLeft: { lat: latTop, lon: lonLeft },
        topRight: { lat: latTop, lon: lonRight },
        bottomLeft: { lat: latBottom, lon: lonLeft },
        bottomRight: { lat: latBottom, lon: lonRight },
    };
}

// Function to convert tile X coordinate and zoom level to longitude
function tileToLong(x: number, z: number): number {
    return (x / Math.pow(2, z)) * 360 - 180;
}

// Function to convert tile Y coordinate and zoom level to latitude (using inverse Mercator)
function tileToLat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}


const R = 6378137; // Earth's radius in meters

// Convert projected coordinates to decimal degrees
const toLon = (x: number) => (x / R) * (180 / Math.PI);
const toLat = (y: number) =>
    (180 / Math.PI) * (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2);

// Function to generate a PNG buffer with tile info drawn on it
async function generateTileImage(
    x: number,
    y: number,
    z: number,
    corners: ReturnType<typeof getTileCorners>,
    size: number = 256 // Default tile size
): Promise<Buffer> {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background color (light gray)
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Set text properties
    ctx.fillStyle = '#000000'; // Black text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw Z/X/Y in the center
    const mainFontSize = size / 16; // Adjust font size relative to tile size
    ctx.font = `${mainFontSize}px Arial`;
    ctx.fillText(`${z}/${x}/${y} ${size}`, size / 4, size / 4);

    // Set smaller font for corner coordinates
    const cornerFontSize = size / 24;
    ctx.font = `${cornerFontSize}px Arial`;
    const padding = 1; // Padding from edges

    // Helper to format coordinates
    const formatCoord = (coord: number) => coord.toFixed(4); // Format to 4 decimal places

    // Draw corner coordinates
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
        `TL: ${formatCoord(corners.topLeft.lat)}, ${formatCoord(corners.topLeft.lon)}`,
        padding,
        padding
    );

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(
        `TR: ${formatCoord(corners.topRight.lat)}, ${formatCoord(corners.topRight.lon)}`,
        size - padding,
        padding
    );

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
        `BL: ${formatCoord(corners.bottomLeft.lat)}, ${formatCoord(corners.bottomLeft.lon)}`,
        padding,
        size - padding
    );

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
        `BR: ${formatCoord(corners.bottomRight.lat)}, ${formatCoord(corners.bottomRight.lon)}`,
        size - padding,
        size - padding
    );

    // Convert canvas to PNG buffer
    return canvas.toBuffer('image/png');
}

// Set up mocking for all tests
export async function mapMocks(page: Page, seenUrls: Set<URL> ) {
    //const seenUrls = new Set<URL>();

    // Mock base layer requests to OSM base layers
    await page.route('**/spatial.ala.org.au/osm/*/*/*.png', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const pathname = url.pathname;

        let requestedSize = 256; // Default tile size

        const pathParts = pathname.split('/');
        // Look for sequences that might be z, x, y numbers
        let z: number | undefined = parseInt(
            pathParts[pathParts.length - 3],
            10
        );
        let x: number | undefined = parseInt(
            pathParts[pathParts.length - 2],
            10
        );
        let y: number | undefined = parseInt(
            pathParts[pathParts.length - 1]
                .replace('@2x', '')
                .replace('.png', ''),
            10
        );

        // detect high DPI
        if (pathParts[pathParts.length - 1].indexOf('@2x') !== -1) {
            requestedSize = 512;
        }

        const corners = getTileCorners(x, y, z);

        // Generate the tile image dynamically
        try {
            const imageBuffer = await generateTileImage(
                x,
                y,
                z,
                corners,
                requestedSize
            );

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: imageBuffer,
            });
        } catch (error) {
            console.error(
                `Error generating mock tile image for ${z}/${x}/${y}:`,
                error
            );
            // If image generation fails, fulfill with an error status or a fallback
            await route.fulfill({
                status: 500, // Internal Server Error
                contentType: 'text/plain',
                body: `Error generating mock tile for ${z}/${x}/${y}`,
            });
        }
    });

    await page.route('**/spatial*.ala.org.au/geoserver/wms*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;

        // Extract query parameters
        const width = parseInt(params.get('width') || '256', 10);
        const height = parseInt(params.get('height') || '256', 10);
        const bbox = params.get('bbox')?.split(',').map(parseFloat); // [minX, minY, maxX, maxY]

        if (!bbox || bbox.length !== 4) {
            await route.fulfill({
                status: 400, // Bad Request
                contentType: 'text/plain',
                body: 'Invalid or missing bbox parameter',
            });
            return;
        }

        const [minX, minY, maxX, maxY] = bbox;

        // Generate the image dynamically
        try {
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Fill background
            ctx.fillStyle = '#CCCCCC';
            ctx.fillRect(0, 0, width, height);

            // Draw border
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);

            // Set text properties
            ctx.fillStyle = '#000000';
            ctx.font = `${Math.min(width, height) / 32}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw info in the center
            let layers = params.get('layers') || 'Unknown Layer';
            ctx.fillText(`${layers}`, width / 2, height / 2 - 20);
            ctx.fillText(
                `${toLon(minX).toFixed(4)}, ${toLat(minY).toFixed(4)}`,
                width / 2,
                height / 2 + 10
            );
            ctx.fillText(
                `${toLon(maxX).toFixed(4)}, ${toLat(maxY).toFixed(4)}`,
                width / 2,
                height / 2 + 30
            );

            const buffer = canvas.toBuffer('image/png');

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: buffer,
            });
        } catch (error) {
            await route.fulfill({
                status: 500, // Internal Server Error
                contentType: 'text/plain',
                body: 'Error generating mock WMS image',
            });
        }
    });

    await page.route('**/biocache-ws.ala.org.au/ws/ogc/wms/reflect*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;

        // Extract query parameters
        const width = parseInt(params.get('width') || '256', 10);
        const height = parseInt(params.get('height') || '256', 10);
        const bbox = params.get('bbox')?.split(',').map(parseFloat); // [minX, minY, maxX, maxY]

        if (!bbox || bbox.length !== 4) {
            await route.fulfill({
                status: 400, // Bad Request
                contentType: 'text/plain',
                body: 'Invalid or missing bbox parameter',
            });
            return;
        }

        const [minX, minY, maxX, maxY] = bbox;

        // Generate the image dynamically
        try {
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Fill background
            ctx.fillStyle = '#CCCCCC';
            ctx.fillRect(0, 0, width, height);

            // Draw border
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);

            // Set text properties
            ctx.fillStyle = '#000000';
            ctx.font = `${Math.min(width, height) / 32}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw info in the center
            let layers = params.get('layers') || 'Unknown Layer';
            ctx.fillText(`${layers}`, width / 2, height / 2 - 20);
            ctx.fillText(
                `${toLon(minX).toFixed(4)}, ${toLat(minY).toFixed(4)}`,
                width / 2,
                height / 2 + 10
            );
            ctx.fillText(
                `${toLon(maxX).toFixed(4)}, ${toLat(maxY).toFixed(4)}`,
                width / 2,
                height / 2 + 30
            );

            const buffer = canvas.toBuffer('image/png');

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: buffer,
            });
        } catch (error) {
            await route.fulfill({
                status: 500, // Internal Server Error
                contentType: 'text/plain',
                body: 'Error generating mock WMS image',
            });
        }
    });
}
