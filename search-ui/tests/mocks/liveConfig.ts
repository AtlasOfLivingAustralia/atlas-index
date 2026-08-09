import * as fs from 'fs';
import * as path from 'path';

export type Op =
    | 'eq' | 'gte' | 'lte' | 'matches' | 'includes'
    | 'exists' | 'eq_computed' | 'all_gte' | 'lte_computed' | 'optional';

export interface Override {
    op: Op;
    value?: unknown;
}

interface LiveConfig {
    baseUrl: string;
    skip?: string[];
    timeout?: { action?: number; navigation?: number; };
    overrides?: Record<string, Override>;
}

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

export function isLiveMode(): boolean { return config !== null; }
export function getBaseUrl(): string { return config?.baseUrl ?? DEFAULT_BASE_URL; }
export function getOverride(key: string): Override | undefined {
    if (!config?.overrides) return undefined;
    return config.overrides[key];
}
export function shouldSkip(testId: string): boolean {
    if (!config?.skip) return false;
    return config.skip.includes(testId);
}
export function getTimeouts(): { action: number; navigation: number } {
    return {
        action: config?.timeout?.action ?? 15000,
        navigation: config?.timeout?.navigation ?? 30000,
    };
}
