// Minimal babel plugin used only by Jest to make `import.meta.env.*`
// references (used throughout the Vite-based source files) parseable and
// runnable under Jest's CommonJS/Babel transform, since Jest does not run
// files as native ES modules. Each `import.meta` MetaProperty is rewritten
// to `globalThis.__IMPORT_META__`, whose `.env` object is populated by
// jest.setup.ts with sensible test defaults.
module.exports = function importMetaEnvPlugin() {
    return {
        visitor: {
            MetaProperty(path) {
                if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
                    path.replaceWithSourceString('globalThis.__IMPORT_META__');
                }
            },
        },
    };
};
