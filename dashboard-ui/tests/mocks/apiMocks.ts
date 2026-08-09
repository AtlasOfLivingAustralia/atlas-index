import {Page} from "@playwright/test";

/**
 * Mock the /session endpoint so App.tsx's checkLoginState resolves cleanly
 * without a network connection. Returns an anonymous (not authenticated)
 * session — dashboard-ui does not require login.
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

/**
 * Mock the banner messages endpoint used by common-ui's <Banner /> component
 * so it does not reach the network. Returns an empty message set — no
 * "global" or scoped message is present, so the banner renders nothing.
 *
 * Must be registered AFTER logMissingMocks so Playwright's
 * reverse-registration priority gives this mock higher priority than the
 * catch-all throw route.
 */
export async function mockBanner(page: Page, seenUrls: Set<URL>, data: object = {}) {
    const url = 'http://localhost:8081/v2/banner';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(data),
        })
    );
}

export async function apiMocks(page: Page, seenUrls: Set<URL> ) {
     // TODO: add a mock and test for the classification hierarchy component

    // Session must be mocked so checkLoginState does not reach the network.
    await mockSession(page, seenUrls);

    // Banner must be mocked so common-ui's <Banner /> does not reach the network.
    await mockBanner(page, seenUrls);
}
