import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        "^.+\\.css$": "jest-transform-css",
        '^.+\\.(ts|tsx)$': 'babel-jest',
    },
    setupFiles: ['./jest.setup.ts'],
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
    collectCoverage: true,
    coverageDirectory: '<rootDir>/coverage',
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.(spec|test).{ts,tsx}',
        '!src/index.ts',
    ],
    coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
};

export default config;
