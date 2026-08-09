/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Shared fixtures, mock data and helper functions for the synthetic coverage specs.
 */

import { Page } from '@playwright/test';
import { imageMocks } from '../mocks/imageServiceMocks';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession } from '../mocks/apiServiceMocks';

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;
export const BIOCACHE_PATTERN = 'https://biocache-ws.ala.org.au/ws/occurrences/search**';

/** One occurrence with 2 imageMetadata entries. fqFirstImageOnly exercises the break. */
export const multiImageOccurrence = {
    uuid: 'occ-multi',
    collectionUid: 'co56',
    collectionName: 'South Australian Museum Terrestrial Invertebrate Collection',
    institutionName: 'South Australian Museum',
    dataProviderName: 'South Australian Museum',
    dataResourceName: 'South Australian Museum Terrestrial Invertebrate Collection',
    scientificName: 'Apis mellifera',
    vernacularName: 'European Honey Bee',
    typeStatus: 'HOLOTYPE',
    imageMetadata: [
        {
            imageId: 'img-001',
            thumbWidth: 400,
            thumbHeight: 300,
            thumbUrl: 'https://images.ala.org.au/image/proxyImageThumbnail?imageId=img-001',
            rightsHolder: 'SAM',
            license: 'CC BY 4.0',
        },
        {
            imageId: 'img-001b',
            thumbWidth: 380,
            thumbHeight: 290,
            thumbUrl: 'https://images.ala.org.au/image/proxyImageThumbnail?imageId=img-001b',
        },
    ],
};

/** Occurrence WITHOUT imageMetadata — tests the skip-without-image-metadata branch. */
export const occurrenceWithoutImages = {
    uuid: 'occ-no-img',
    collectionUid: 'co56',
    collectionName: 'South Australian Museum Terrestrial Invertebrate Collection',
    scientificName: 'Bare species',
    // intentionally no imageMetadata field
};

/** Standard kingdom-facet response returned for the all-collections default view. */
export function kingdomFacetResponse(totalRecords = 8453030) {
    return {
        pageSize: 2,
        startIndex: 0,
        totalRecords,
        status: 'OK',
        facetResults: [
            {
                fieldName: 'typeStatus',
                fieldResult: [
                    { label: 'HOLOTYPE', count: 12500, fq: 'typeStatus:"HOLOTYPE"' },
                    { label: 'PARATYPE', count: 8200, fq: 'typeStatus:"PARATYPE"' },
                ],
            },
            {
                fieldName: 'raw_sex',
                fieldResult: [
                    { label: 'Male', count: 425000, fq: 'raw_sex:"Male"' },
                    { label: 'Female', count: 398000, fq: 'raw_sex:"Female"' },
                    { label: 'Not supplied', count: 7630030, fq: '-raw_sex:*' },
                ],
            },
            {
                fieldName: 'kingdom',
                fieldResult: [
                    { label: 'Animalia', count: 8453030, fq: 'kingdom:"Animalia"' },
                    { label: 'Plantae', count: 1245678, fq: 'kingdom:"Plantae"' },
                ],
            },
        ],
        occurrences: [multiImageOccurrence],
    };
}

/** Phylum facet response after Animalia is selected. */
export function phylumFacetResponse() {
    return {
        pageSize: 2,
        startIndex: 0,
        totalRecords: 8453030,
        status: 'OK',
        facetResults: [
            {
                fieldName: 'typeStatus',
                fieldResult: [{ label: 'HOLOTYPE', count: 12500, fq: 'typeStatus:"HOLOTYPE"' }],
            },
            {
                fieldName: 'raw_sex',
                fieldResult: [
                    { label: 'Male', count: 425000, fq: 'raw_sex:"Male"' },
                    { label: 'Female', count: 398000, fq: 'raw_sex:"Female"' },
                ],
            },
            {
                fieldName: 'phylum',
                fieldResult: [
                    { label: 'Arthropoda', count: 7200000, fq: 'phylum:"Arthropoda"' },
                    { label: 'Chordata', count: 853030, fq: 'phylum:"Chordata"' },
                ],
            },
        ],
        occurrences: [multiImageOccurrence],
    };
}

/**
 * Set up the full mock stack. Routes are registered in this order so Playwright
 * (which tries handlers in reverse-registration order) prioritises the api
 * handler over the logMissingMocks catch-all.
 */
export async function setupMocks(page: Page, apiSetup: (page: Page) => Promise<void>) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await imageMocks(page, seenUrls);
    await apiSetup(page);
    // Session must be mocked last so it wins over the logMissingMocks catch-all.
    await mockSession(page, seenUrls);
}

/** Default kingdom-facet mock used for most Browse tests. */
export async function setupDefaultMock(page: Page) {
    await page.route(BIOCACHE_PATTERN, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(kingdomFacetResponse()),
        })
    );
}

/** Response representing an API 404 — exercises the "no results" branch. */
export async function setupNoResultsMock(page: Page) {
    await page.route(BIOCACHE_PATTERN, (route) =>
        route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    );
}

/** Response representing a 500 server error — exercises the "error" branch. */
export async function setupErrorMock(page: Page) {
    await page.route(BIOCACHE_PATTERN, (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );
}

/** Abort the network request altogether — also triggers the "error" catch branch. */
export async function setupAbortMock(page: Page) {
    await page.route(BIOCACHE_PATTERN, (route) => route.abort('failed'));
}
