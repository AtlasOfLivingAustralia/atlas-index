import { test as baseTest, expect as baseExpect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getOverride, isLiveMode, getBaseUrl, Op } from './mocks/liveConfig';

// ---------------------------------------------------------------------------
// Istanbul coverage collection + console/network diagnostics
// ---------------------------------------------------------------------------

const nycOutputDir = path.resolve(process.cwd(), '.nyc_output');

const testWithCoverage = baseTest.extend<object>({
    // eslint-disable-next-line no-empty-pattern
    page: async ({ page }, use, testInfo) => {

        const appOrigin = new URL(getBaseUrl()).origin;
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                const text = msg.text();
                if (text.includes('GPU stall') || text.includes('WebGL')) return;
                if (text.includes('downloadable font') || text.includes('glyph')) return;
                // Leaflet (mapView.tsx) always tries to bind a 'touchleave' pointer-event
                // listener regardless of touch support; Playwright's desktop browsers log
                // "wrong event specified: touchleave" as a benign console warning on every
                // map render. Not indicative of an app bug -- filtered globally to avoid
                // drowning out genuine warnings/errors (it fires on nearly every map test).
                if (text.includes('wrong event specified: touchleave')) return;
                // KNOWN APP BUG (see PLAYWRIGHT_TEST.md "Discrepancies found"): three
                // translation keys (home.index.simsplesearch.span, search.map.importText,
                // search.map.importText.spatialportal) use react-intl rich-text tags like
                // <b>...</b> without passing the corresponding `values={{b: ...}}` mapping
                // to formatMessage(), which react-intl logs a FORMAT_ERROR / INVALID_TAG
                // console.error on every render of OccurrenceSearch.tsx's Simple/Spatial
                // search tabs -- independent of mocking, and since the Spatial tab's
                // <MapContainer> mounts eagerly on every home-page load (react-bootstrap's
                // <Tabs> defaults mountOnEnter=false), this fires on nearly every test.
                // Filtered globally here (the dedicated home-no-console-errors test has its
                // own separate, identically-filtered listener so it still catches *new*
                // regressions) rather than left to spam every other test's output.
                if (text.includes('FORMAT_ERROR') || text.includes('INVALID_TAG')) return;
                // Expected: tests that simulate a network failure via route.abort() cause
                // the browser to report the aborted cross-origin request as a CORS error
                // (this is how Firefox/Chromium describe any failed cross-origin fetch, not
                // an indication of a missing/incorrect mock -- a truly unmocked URL is
                // instead caught by logMissingMocks, which throws and fails the test directly).
                if (text.includes('CORS request did not succeed') || text.includes('Cross-Origin Request Blocked')) return;
                const location = msg.location().url ?? '';
                if (location && !location.startsWith(appOrigin)) return;
                console.error(`[browser ${msg.type()}] ${testInfo.title}: ${text}`);
            }
        });

        page.on('requestfailed', request => {
            const reason = request.failure()?.errorText ?? '';
            if (reason.includes('NS_BINDING_ABORTED') || reason.includes('ERR_ABORTED') || reason === 'cancelled') return;
            if (!request.url().startsWith(appOrigin)) return;
            console.error(`[request failed] ${testInfo.title}: ${request.method()} ${request.url()} — ${reason}`);
        });

        page.on('response', response => {
            const status = response.status();
            if (status >= 400 && response.url().startsWith(appOrigin)) {
                console.error(`[http ${status}] ${testInfo.title}: ${response.request().method()} ${response.url()}`);
            }
        });

        await use(page);

        try {
            const coverage = await page.evaluate(() => (window as any).__coverage__);
            if (coverage) {
                fs.mkdirSync(nycOutputDir, { recursive: true });
                const safeTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
                const file = path.join(
                    nycOutputDir,
                    `coverage_${testInfo.workerIndex}_${testInfo.retry}_${safeTitle}.json`
                );
                fs.writeFileSync(file, JSON.stringify(coverage));
            }
        } catch {
            // page may already be closed — ignore
        }
    },
});

// ---------------------------------------------------------------------------
// Override-aware expect
// ---------------------------------------------------------------------------

function applyOverride(
    matchers: ReturnType<typeof baseExpect>,
    op: Op,
    value: unknown,
    defaultValue: unknown
): Promise<void> | void {
    switch (op) {
        case 'eq':    return (matchers as any).toBe(value);
        case 'gte':   return (matchers as any).toBeGreaterThanOrEqual(value);
        case 'lte':   return (matchers as any).toBeLessThanOrEqual(value);
        case 'matches': return (matchers as any).toMatch(new RegExp(value as string));
        case 'includes': return (matchers as any).toContain(value);
        case 'exists':   return (matchers as any).toBeTruthy();
        case 'eq_computed':  return (matchers as any).toBe(defaultValue);
        case 'lte_computed': return (matchers as any).toBeLessThanOrEqual(defaultValue);
        case 'all_gte':      return (matchers as any).toBeGreaterThanOrEqual(value);
        case 'optional':     return;
        default: return (matchers as any).toBe(defaultValue);
    }
}

function buildMatchersProxy(
    realMatchers: ReturnType<typeof baseExpect>,
    key: string | undefined
): ReturnType<typeof baseExpect> {
    return new Proxy(realMatchers, {
        get(target, prop: string) {
            const original = (target as any)[prop];
            if (typeof original !== 'function') return original;
            return (...args: unknown[]) => {
                if (!isLiveMode() || !key) return original.apply(target, args);
                const override = getOverride(key);
                if (!override) return original.apply(target, args);
                const defaultValue = args[0];
                return applyOverride(target, override.op, override.value, defaultValue);
            };
        },
    }) as ReturnType<typeof baseExpect>;
}

export const expect = new Proxy(baseExpect, {
    apply(target, thisArg, [actual, keyOrMessage]: [unknown, string?]) {
        const realMatchers = target.call(thisArg, actual, keyOrMessage);
        return buildMatchersProxy(realMatchers, keyOrMessage);
    },
}) as typeof baseExpect;

export { testWithCoverage as test };
