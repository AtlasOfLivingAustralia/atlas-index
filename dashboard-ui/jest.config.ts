import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.css$': 'jest-transform-css',
        '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.jest.config.cjs' }],
    },
    moduleNameMapper: {
        '^@ala/common-ui/viteEnvCheckPlugin$': '<rootDir>/../common-ui/src/viteEnvCheckPlugin.ts',
        '^@ala/common-ui$': '<rootDir>/../common-ui/src/index.ts',
        '^react-intl$': '<rootDir>/jest.reactIntlMock.tsx',
        // Source imports a sibling component with a `.jsx` extension even
        // though the actual file on disk is `.tsx` (Vite resolves this
        // transparently; Jest's resolver does not), so remap it here.
        '^(\\.{1,2}/.*)\\.jsx$': '$1.tsx',
        // CSS imported from node_modules (e.g. react-bootstrap-typeahead,
        // bootstrap-icons) is not run through the `jest-transform-css`
        // transform, since Jest's default transformIgnorePatterns excludes
        // node_modules. Map all CSS imports to a stub instead.
        '\\.css$': '<rootDir>/jest.cssMock.cjs',
    },
    setupFiles: ['./jest.setup.ts'],
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
    testMatch: ['<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
};

export default config;
