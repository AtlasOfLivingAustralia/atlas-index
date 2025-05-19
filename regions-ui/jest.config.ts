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
};

export default config;
