import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    // Only run unit tests colocated with source files. The tests/ directory
    // contains Playwright specs (tests/acceptance.spec.ts, tests/synthetic/**)
    // which must not be picked up by jest — they use @playwright/test's
    // test/expect, not jest's globals, and require a running browser + mocks.
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
};

export default config;
