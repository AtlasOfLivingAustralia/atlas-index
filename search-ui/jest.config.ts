import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.css$': 'jest-transform-css',
        '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './.babelrc' }],
    },
    transformIgnorePatterns: ['node_modules/(?!(react-intl|@formatjs|intl-messageformat)/)'],
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
};

export default config;
