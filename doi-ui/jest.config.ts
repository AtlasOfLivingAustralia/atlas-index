import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.css$': 'jest-transform-css',
        '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.jest.config.cjs' }]
    },
    setupFiles: ['./jest.setup.ts'],
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
    moduleNameMapper: {
        '^@ala/common-ui/viteEnvCheckPlugin$': '<rootDir>/../common-ui/src/viteEnvCheckPlugin.ts',
        '^@ala/common-ui$': '<rootDir>/../common-ui/src/index.ts'
    },
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)']
};

export default config;
