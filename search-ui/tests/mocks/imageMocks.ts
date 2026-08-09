import { Page } from '@playwright/test';
import { createCanvas } from 'canvas';

/**
 * Generate a mock species image with a text overlay identifying the image id.
 * Used for species header/thumbnail images, gallery grid images, and the
 * full-size modal viewer image.
 */
async function generateSpeciesImage(imageId: string, width: number = 400, height: number = 300): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#4E7A51');
    gradient.addColorStop(0.5, '#7FA37A');
    gradient.addColorStop(1, '#C7D9B8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 18 + 4;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.strokeStyle = '#2E4A30';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(10, height - 44, width - 20, 34);
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Species image: ${imageId}`, width / 2, height - 27);

    return canvas.toBuffer('image/png');
}

/** Generate a small placeholder PNG for map tiles / WMS layer responses. */
async function generateTilePlaceholder(width: number = 256, height: number = 256): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(196, 77, 52, 0.4)';
    ctx.fillRect(0, 0, width, height);
    return canvas.toBuffer('image/png');
}

/**
 * Register image-service mocks. Covers:
 *  - thumbnail requests (species header, gallery grid)
 *  - full-size proxyImage requests (modal viewer, header <a> link target)
 *  - bare /image/{id} catch-all (link targets opened in a new tab)
 */
export async function imageMocks(page: Page, seenUrls: Set<URL>) {
    await page.context().route('**/images*.ala.org.au/image/proxyImageThumbnail*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const imageId = url.searchParams.get('imageId') || 'unknown';
        try {
            const imageBuffer = await generateSpeciesImage(imageId, 400, 300);
            await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating image for ${imageId}: ${error}` });
        }
    });

    await page.context().route('**/images*.ala.org.au/image/proxyImage*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const imageId = url.searchParams.get('imageId') || 'unknown';
        try {
            const imageBuffer = await generateSpeciesImage(imageId, 800, 600);
            await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating image for ${imageId}: ${error}` });
        }
    });

    // Catch-all: bare /image/{id} link target (species header <a href>, gallery "View image details" link)
    await page.context().route('**/images*.ala.org.au/image/*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const pathParts = url.pathname.split('/');
        const imageId = pathParts[pathParts.length - 1] || 'unknown';
        try {
            const imageBuffer = await generateSpeciesImage(imageId, 800, 600);
            await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating image for ${imageId}: ${error}` });
        }
    });

    await page.context().route('**/images*.ala.org.au/proxyImage*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const imageId = url.searchParams.get('imageId') || 'unknown';
        try {
            const imageBuffer = await generateSpeciesImage(imageId, 400, 300);
            await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating image for ${imageId}: ${error}` });
        }
    });
}

export { generateTilePlaceholder };
