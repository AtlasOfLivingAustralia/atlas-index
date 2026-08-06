import { Page } from '@playwright/test';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import {
    mockSession,
    mockDoiList,
    mockDoiDetail,
    mockDoiDownload,
    mockBiocacheStatus,
    mockBiocacheCancel,
    SESSION_ANONYMOUS,
    SESSION_USER,
    SESSION_ADMIN,
    SESSION_SDS_ACT,
} from '../mocks/apiMocks';

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;

// Re-export user fixtures for convenience
export { SESSION_ANONYMOUS, SESSION_USER, SESSION_ADMIN, SESSION_SDS_ACT };
export { DOI_BIOCACHE_UUID, DOI_CSDM_UUID, DOI_RESTRICTED_UUID, DOI_UNPUBLISHED_UUID, DOI_NO_FILE_UUID } from '../mocks/apiMocks';

/**
 * Minimal setup: catch-all guard + session + DOI list.
 * Used by Home and any test that just needs the page to load.
 */
export async function setupDefault(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockDoiList(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/**
 * Setup for a DOI detail page.
 */
export async function setupDoi(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockDoiDetail(page, seenUrls);
    await mockDoiDownload(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/**
 * Setup for MyDownloads page.
 */
export async function setupMyDownloads(page: Page, sessionData: object = SESSION_USER, activeDownloads: object = {}) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockDoiList(page, seenUrls);
    await mockDoiDetail(page, seenUrls);
    await mockDoiDownload(page, seenUrls);
    await mockBiocacheStatus(page, seenUrls, activeDownloads);
    await mockBiocacheCancel(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/** Navigate and wait for networkidle. */
export async function load(page: Page, url = BASE_URL) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

/** Wait for the placeholder-glow skeleton to disappear. */
export async function waitForContent(page: Page) {
    await page.locator('.placeholder-glow').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
        // skeleton may never appear for fast responses — that's fine
    });
}
