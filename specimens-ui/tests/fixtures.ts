import { test as baseTest, expect as baseExpect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getOverride, isLiveMode, Op } from './mocks/liveConfig';

// ---------------------------------------------------------------------------
// Istanbul coverage collection
//
// When the app is built with vite-plugin-istanbul (PLAYWRIGHT_ENV=true),
// window.__coverage__ is populated in the browser.  After each test we
// snapshot it into .nyc_output/ so that `nyc report` can produce a combined
// summary across all tests and all browsers.
// ---------------------------------------------------------------------------

const nycOutputDir = path.resolve(process.cwd(), '.nyc_output');

const testWithCoverage = baseTest.extend<object, { workerCoverageIndex: number }>({
    // eslint-disable-next-line no-empty-pattern
    page: async ({ page }, use, testInfo) => {
        await use(page);

        // Collect Istanbul coverage from the browser after every test.
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
            // page may be closed already — ignore
        }
    },
});

// ---------------------------------------------------------------------------
// Override-aware expect
//
// Usage (in tests):
//   import { test, expect } from './fixtures';
//   expect(thumbnailCount, 'home.thumbnailCount').toBeGreaterThan(1);
//
// In mock mode the second arg is ignored and the assertion runs as written.
// In live mode the second arg is used as a key to look up an override in the
// live config. When an override is found, the op/value from the config
// replaces the original matcher call. When no override exists the assertion
// runs as written (default — strict, same as mock mode).
//
// The second arg therefore doubles as both the failure message (Playwright
// prints it on failure) and the exact config key that needs to be added or
// updated to fix the failure.
// ---------------------------------------------------------------------------


/**
 * Map an override op + value onto a concrete Playwright matcher call.
 *
 * @param matchers  The real Playwright matchers object.
 * @param op        The op from the live config override.
 * @param value     The value from the live config override (may be undefined).
 * @param defaultValue  The value that was passed to the original matcher call
 *                      (used for eq_computed / lte_computed which keep the
 *                      original comparison but document intent in config).
 */
function applyOverride(
    matchers: ReturnType<typeof baseExpect>,
    op: Op,
    value: unknown,
    defaultValue: unknown
): Promise<void> | void {
    switch (op) {
        case 'eq':
            return (matchers as any).toBe(value);
        case 'gte':
            return (matchers as any).toBeGreaterThanOrEqual(value);
        case 'lte':
            return (matchers as any).toBeLessThanOrEqual(value);
        case 'matches':
            return (matchers as any).toMatch(new RegExp(value as string));
        case 'includes':
            return (matchers as any).toContain(value);
        case 'exists':
            return (matchers as any).toBeTruthy();
        case 'eq_computed':
            // The comparison is derived from live data — keep the original value.
            return (matchers as any).toBe(defaultValue);
        case 'lte_computed':
            // The bound is derived from live data — keep the original value.
            return (matchers as any).toBeLessThanOrEqual(defaultValue);
        case 'all_gte':
            // Caller is responsible for iterating; treat as gte here.
            return (matchers as any).toBeGreaterThanOrEqual(value);
        case 'optional':
            // No assertion — the value is allowed to be anything.
            // Use when the data may legitimately not satisfy the default comparison.
            return;
        default:
            // Unknown op — fall back to original value with toBe.
            return (matchers as any).toBe(defaultValue);
    }
}

/**
 * Build a proxied Matchers object that intercepts matcher calls and routes
 * them through the live config override when applicable.
 */
function buildMatchersProxy(
    realMatchers: ReturnType<typeof baseExpect>,
    key: string | undefined
): ReturnType<typeof baseExpect> {
    return new Proxy(realMatchers, {
        get(target, prop: string) {
            const original = (target as any)[prop];

            // Only intercept function-valued properties that look like matchers.
            if (typeof original !== 'function') {
                return original;
            }

            return (...args: unknown[]) => {
                // In mock mode, or when no key is provided, run unchanged.
                if (!isLiveMode() || !key) {
                    return original.apply(target, args);
                }

                const override = getOverride(key);
                if (!override) {
                    // No override configured — use strict default (same as mock).
                    return original.apply(target, args);
                }

                // Apply the configured override instead of the original call.
                // defaultValue is the first arg to the original matcher (e.g.
                // the value passed to .toBe() or .toBeGreaterThan()).
                const defaultValue = args[0];
                return applyOverride(target, override.op, override.value, defaultValue);
            };
        },
    }) as ReturnType<typeof baseExpect>;
}

/**
 * Override-aware expect.
 *
 * When the second argument (message/key) is provided and we are in live mode,
 * the returned matchers object checks the live config for an override keyed
 * by that string before running any matcher.
 */
export const expect = new Proxy(baseExpect, {
    apply(target, thisArg, [actual, keyOrMessage]: [unknown, string?]) {
        const realMatchers = target.call(thisArg, actual, keyOrMessage);
        return buildMatchersProxy(realMatchers, keyOrMessage);
    },
}) as typeof baseExpect;

// Re-export test unchanged so callers can do:
//   import { test, expect } from './fixtures';
export { testWithCoverage as test };
