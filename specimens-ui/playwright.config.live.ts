import { defineConfig, devices } from '@playwright/test';
// @ts-ignore
import dotenv from 'dotenv';
// @ts-ignore
import path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load base env vars from .env.playwright (auth cookies, contact URLs, etc.)
dotenv.config({ path: path.resolve(__dirname, '.env.playwright'), quiet: true });

interface LiveConfigShape {
    baseUrl: string;
    timeout?: { action?: number; navigation?: number };
}

// Read required fields from the live config file (set by run-live-test.sh via LIVE_CONFIG_PATH).
function readLiveConfig(): LiveConfigShape {
    const configPath = process.env.LIVE_CONFIG_PATH;
    if (!configPath) {
        throw new Error(
            '[playwright.config.live] LIVE_CONFIG_PATH env var is not set. ' +
            'Use run-live-test.sh to start live tests.'
        );
    }
    const resolved = path.resolve(configPath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`[playwright.config.live] Config file not found: ${resolved}`);
    }
    const config = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as LiveConfigShape;
    if (!config.baseUrl) {
        throw new Error(`[playwright.config.live] Config file missing required field: baseUrl`);
    }
    return config;
}

const liveConfig = readLiveConfig();

const actionTimeout    = liveConfig.timeout?.action     ?? 15000;
const navigationTimeout = liveConfig.timeout?.navigation ?? 30000;

export default defineConfig({
    testDir: './tests',
    testMatch: ['**/acceptance.spec.{js,ts,mjs,mts,jsx,tsx}'],
    fullyParallel: true,
    retries: 0,
    reporter: [['dot'], ['html', { open: 'never' }]],
    use: {
        baseURL: liveConfig.baseUrl,
        actionTimeout,
        navigationTimeout,
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
});
