/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Page } from '@playwright/test';
import { createCanvas } from 'canvas';

/**
 * Generate a mock specimen image with text overlay
 */
async function generateSpecimenImage(imageId: string, width: number = 400, height: number = 300): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create a gradient background to simulate a specimen photo
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#8B4513'); // Brown
    gradient.addColorStop(0.5, '#D2691E'); // Chocolate
    gradient.addColorStop(1, '#F4A460'); // Sandy brown

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some texture to simulate a specimen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 20 + 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Add border
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);

    // Add text overlay with image ID
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(10, height - 60, width - 20, 50);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Specimen Image`, width / 2, height - 40);
    ctx.font = '12px Arial';
    ctx.fillText(`ID: ${imageId}`, width / 2, height - 20);

    // Convert canvas to PNG buffer
    return canvas.toBuffer('image/png');
}

/**
 * Generate a mock collection thumbnail image
 */
async function generateCollectionThumbnail(collectionName: string, width: number = 300, height: number = 200): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#4A90E2'); // Blue
    gradient.addColorStop(0.5, '#7B68EE'); // Medium slate blue
    gradient.addColorStop(1, '#9370DB'); // Medium purple

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 40 + 10;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Add border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, width, height);

    // Add text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap text if too long
    const maxWidth = width - 40;
    const words = collectionName.split(' ');
    let lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    // Draw text lines
    const lineHeight = 22;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, startY + i * lineHeight);
    });

    // Convert canvas to PNG buffer
    return canvas.toBuffer('image/png');
}

export async function imageMocks(page: Page, seenUrls: Set<URL>) {
    /**
     * Mock image service thumbnail requests
     */
    await page.route('**/images*.ala.org.au/image/proxyImageThumbnail*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        const imageId = url.searchParams.get('imageId') || 'unknown';

        try {
            const imageBuffer = await generateSpecimenImage(imageId, 400, 300);

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: imageBuffer
            });
        } catch (error) {
            console.error(`Error generating specimen image for ${imageId}:`, error);
            await route.fulfill({
                status: 500,
                contentType: 'text/plain',
                body: `Error generating specimen image for ${imageId}`
            });
        }
    });

    /**
     * Mock image service large thumbnail requests (for collections)
     */
    await page.route('**/images*.ala.org.au/image/proxyImageThumbnailLarge*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        const imageId = url.searchParams.get('imageId') || 'unknown';

        try {
            const imageBuffer = await generateCollectionThumbnail('Collection', 300, 200);

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: imageBuffer
            });
        } catch (error) {
            console.error(`Error generating collection thumbnail for ${imageId}:`, error);
            await route.fulfill({
                status: 500,
                contentType: 'text/plain',
                body: `Error generating collection thumbnail for ${imageId}`
            });
        }
    });

    /**
     * Mock image viewer page (large image view)
     */
    await page.route('**/images*.ala.org.au/image/*', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        // Extract image ID from path
        const pathParts = url.pathname.split('/');
        const imageId = pathParts[pathParts.length - 1];

        try {
            const imageBuffer = await generateSpecimenImage(imageId, 800, 600);

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: imageBuffer
            });
        } catch (error) {
            console.error(`Error generating large image for ${imageId}:`, error);
            await route.fulfill({
                status: 500,
                contentType: 'text/plain',
                body: `Error generating large image for ${imageId}`
            });
        }
    });
}
