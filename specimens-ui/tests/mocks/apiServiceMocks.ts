/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const g_occurrencesWithImagesPath = path.resolve(__dirname, '../resources/occurrences-with-images.json');
const g_occurrencesWithImages = JSON.parse(fs.readFileSync(g_occurrencesWithImagesPath, 'utf-8'));

const g_phylumFacetPath = path.resolve(__dirname, '../resources/phylum-facet.json');
const g_phylumFacet = JSON.parse(fs.readFileSync(g_phylumFacetPath, 'utf-8'));

// Mock fixtures for the collection-browse test (default mock collection: co56)
const g_collectionBrowsePath = path.resolve(__dirname, '../resources/collection-co56.json');
const g_collectionBrowse = JSON.parse(fs.readFileSync(g_collectionBrowsePath, 'utf-8'));

const g_collectionBrowseOrdersPath = path.resolve(__dirname, '../resources/collection-co56-orders.json');
const g_collectionBrowseOrders = JSON.parse(fs.readFileSync(g_collectionBrowseOrdersPath, 'utf-8'));

const g_collectionBrowseHolotypesPath = path.resolve(__dirname, '../resources/collection-co56-holotypes.json');
const g_collectionBrowseHolotypes = JSON.parse(fs.readFileSync(g_collectionBrowseHolotypesPath, 'utf-8'));

const g_collectionBrowseClassPath = path.resolve(__dirname, '../resources/collection-co56-class.json');
const g_collectionBrowseClass = JSON.parse(fs.readFileSync(g_collectionBrowseClassPath, 'utf-8'));

const g_collectionBrowsePhylumPath = path.resolve(__dirname, '../resources/collection-co56-phylum.json');
const g_collectionBrowsePhylum = JSON.parse(fs.readFileSync(g_collectionBrowsePhylumPath, 'utf-8'));

const g_collectionBrowseFamiliesPath = path.resolve(__dirname, '../resources/collection-co56-families.json');
const g_collectionBrowseFamilies = JSON.parse(fs.readFileSync(g_collectionBrowseFamiliesPath, 'utf-8'));

export async function apiMocks(page: Page, seenUrls: Set<URL>) {
    /**
     * Mock biocache-ws occurrences/search endpoint
     * This is the main API endpoint for specimen searches
     */
    await page.route('https://biocache-ws.ala.org.au/ws/occurrences/search**', async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        const facets = url.searchParams.get('facets');
        const fqs = url.searchParams.getAll('fq');
        const startParam = url.searchParams.get('start');
        const start = startParam ? parseInt(startParam, 10) : 0;

        // Determine which collection is being queried
        const collectionUidFilter = fqs.find(f => f.startsWith('collectionUid:'));
        const isCollectionBrowse = collectionUidFilter?.includes('co56');

        // Determine taxonomy filters
        const hasKingdom = fqs.some(f => f.startsWith('kingdom:'));
        const hasPhylum = fqs.some(f => f.startsWith('phylum:'));
        const hasClass = fqs.some(f => f.startsWith('class:'));
        const hasOrder = fqs.some(f => f.startsWith('order:'));

        // Determine other filters
        const isHolotype = fqs.some(f => f.includes('HOLOTYPE'));

        var response;

        // Collection browse test: holotype filter
        if (isCollectionBrowse && isHolotype) {
            response = JSON.parse(JSON.stringify(g_collectionBrowseHolotypes));
            response.startIndex = start;
        }
        // Collection browse test: all 4 ranks set (Kingdom, Phylum, Class, Order) - show families
        else if (isCollectionBrowse && hasKingdom && hasPhylum && hasClass && hasOrder && fqs.some(f => f.includes('order:"Coleoptera"')) && facets?.includes('family')) {
            response = JSON.parse(JSON.stringify(g_collectionBrowseFamilies));
            response.startIndex = start;
        }
        // Collection browse test: all 3 ranks set (Kingdom, Phylum, Class) - show orders
        else if (isCollectionBrowse && hasKingdom && hasPhylum && hasClass && facets?.includes('order')) {
            response = JSON.parse(JSON.stringify(g_collectionBrowseOrders));
            response.startIndex = start;
        }
        // Collection browse test: Kingdom and Phylum set - return single Class for auto-drill
        else if (isCollectionBrowse && hasKingdom && hasPhylum && facets?.includes('class')) {
            response = JSON.parse(JSON.stringify(g_collectionBrowseClass));
            response.startIndex = start;
        }
        // Collection browse test: only Kingdom set - return single Phylum for auto-drill
        else if (isCollectionBrowse && hasKingdom && facets?.includes('phylum')) {
            response = JSON.parse(JSON.stringify(g_collectionBrowsePhylum));
            response.startIndex = start;
        }
        // Collection browse test: initial view (show single kingdom facet for auto-drill)
        else if (isCollectionBrowse && facets?.includes('kingdom')) {
            response = JSON.parse(JSON.stringify(g_collectionBrowse));
            response.startIndex = start;
        }
        // Animalia kingdom selected (show phylum facet)
        else if (hasKingdom && facets?.includes('phylum')) {
            response = JSON.parse(JSON.stringify(g_phylumFacet));
            response.startIndex = start;
        }
        // All collections default view (show kingdom facet)
        else {
            response = JSON.parse(JSON.stringify(g_occurrencesWithImages));
            response.startIndex = start;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
        });
    });

    // Session must be mocked so checkLoginState does not reach the network.
    await mockSession(page, seenUrls);
}

/**
 * Mock the /session endpoint so App.tsx's checkLoginState resolves cleanly
 * without a network connection. Returns an anonymous (not authenticated)
 * session — specimens-ui does not require login.
 *
 * Must be registered AFTER logMissingMocks so Playwright's
 * reverse-registration priority gives this mock higher priority than the
 * catch-all throw route.
 */
export async function mockSession(page: Page, seenUrls: Set<URL>) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false }),
        })
    );
}
