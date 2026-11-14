import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.css$': 'jest-transform-css',
        '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.jest.config.cjs' }],
        // nuqs and react-leaflet ship ESM-only; transform them through babel too.
        'node_modules/(nuqs|react-leaflet|@react-leaflet)/.+\\.js$': ['babel-jest', { configFile: './babel.jest.config.cjs' }]
    },
    transformIgnorePatterns: ['/node_modules/(?!(nuqs|react-leaflet|@react-leaflet|.*\\.css))'],
    setupFiles: ['./jest.setup.ts'],
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
    moduleNameMapper: {
        '^@ala/common-ui/viteEnvCheckPlugin$': '<rootDir>/../common-ui/src/viteEnvCheckPlugin.ts',
        '^@ala/common-ui$': '<rootDir>/../common-ui/src/index.ts'
    },
    // Only run unit tests colocated with source files. The tests/ directory
    // contains Playwright specs (tests/acceptance.spec.ts, tests/synthetic/**)
    // which must not be picked up by jest -- they use @playwright/test's
    // test/expect, not jest's globals, and require a running browser + mocks.
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)']
};

export default config;
