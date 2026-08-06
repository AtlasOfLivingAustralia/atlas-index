import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: ['**/*.spec.{js,ts,mjs,mts,jsx,tsx}'],
    fullyParallel: true,
    retries: 0,
    reporter: 'html',
    use: {
        trace: 'on-first-retry',
        actionTimeout: 10000,     // 10 seconds for each action
        navigationTimeout: 20000, // 20 seconds for navigation
    },
    timeout: 30000, // 30 seconds for each test

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
