import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests',
    testMatch: ['**/*.spec.{js,ts,mjs,mts,jsx,tsx}'],
    fullyParallel: true,
    retries: 0,
    reporter: 'html',
    use: {
        trace: 'on-first-retry',
        actionTimeout: 10000,
        navigationTimeout: 20000,
    },
    timeout: 30000,

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
