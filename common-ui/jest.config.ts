import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        "^.+\\.css$": "jest-transform-css",
        '^.+\\.(ts|tsx)$': 'babel-jest',
        // react-intl (ESM) is transformed via transformIgnorePatterns below, so .js needs a
        // transformer too. It carries its own inline config because .babelrc does not apply to
        // files outside this package, which is where react-intl lives.
        '^.+\\.(js|jsx|mjs)$': [
            'babel-jest',
            {
                babelrc: false,
                configFile: false,
                presets: [['@babel/preset-env', {targets: {node: 'current'}}]],
            },
        ],
    },
    setupFiles: ['./jest.setup.ts'],
    // react-intl ships ESM only. It is reached transitively through the src/index.ts barrel (a test
    // importing any component pulls in i18nProvider), so Jest has to transform it rather than skip it.
    transformIgnorePatterns: ['node_modules/(?!(react-intl|intl-messageformat|@formatjs)/)'],
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
