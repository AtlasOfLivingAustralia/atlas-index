/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as fs from 'fs';
import * as path from 'path';

export type Op =
    | 'eq'
    | 'gte'
    | 'lte'
    | 'matches'
    | 'includes'
    | 'exists'
    | 'eq_computed'
    | 'all_gte'
    | 'lte_computed'
    | 'optional';

export interface Override {
    op: Op;
    value?: unknown;
}

interface LiveConfig {
    baseUrl: string;
    skip?: string[];
    /** Timeout overrides in milliseconds. Defaults: actionTimeout 15000, navigationTimeout 30000. */
    timeout?: {
        action?: number;
        navigation?: number;
    };
    overrides?: Record<string, Override>;
}

// ---------------------------------------------------------------------------
// Load config once at module initialisation
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;

let config: LiveConfig | null = null;

const configPath = process.env.LIVE_CONFIG_PATH;
if (configPath) {
    const resolved = path.resolve(configPath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`[liveConfig] LIVE_CONFIG_PATH set but file not found: ${resolved}`);
    }
    config = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as LiveConfig;
}

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

/** True when running against a live environment (LIVE_CONFIG_PATH is set). */
export function isLiveMode(): boolean {
    return config !== null;
}

/** The base URL for page.goto() calls. Defaults to localhost in mock mode. */
export function getBaseUrl(): string {
    return config?.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * Look up an override for the given assertion key.
 * Returns undefined when no override is configured or not in live mode.
 */
export function getOverride(key: string): Override | undefined {
    if (!config?.overrides) return undefined;
    return config.overrides[key];
}

/**
 * Returns true when the given test ID should be skipped.
 * Only ever skips in live mode — mock runs always run all tests.
 * List test IDs to skip in config.skip, e.g. ["xml-last-modified"].
 */
export function shouldSkip(testId: string): boolean {
    if (!config?.skip) return false;
    return config.skip.includes(testId);
}

/**
 * Timeout configuration for Playwright actions and navigation.
 * Returns the configured values or the defaults used by playwright.config.live.ts.
 */
export function getTimeouts(): { action: number; navigation: number } {
    return {
        action: config?.timeout?.action ?? 15000,
        navigation: config?.timeout?.navigation ?? 30000,
    };
}
