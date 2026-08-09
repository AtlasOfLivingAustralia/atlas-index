import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.(ts|tsx)$': 'babel-jest',
    },
    moduleNameMapper: {
        '\\.css$': '<rootDir>/jest.cssMock.js',
    },
    setupFiles: ['./jest.setup.ts'],
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
};

export default config;
