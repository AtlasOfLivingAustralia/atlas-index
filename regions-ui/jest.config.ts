import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.(ts|tsx)$': 'babel-jest',
    },
};

export default config;
