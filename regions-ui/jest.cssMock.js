// Jest moduleNameMapper target for all `*.css` imports (including CSS Modules).
// Returns a Proxy so that any accessed class-name property (used by CSS
// Modules, e.g. `styles.pageLoading`) resolves to that same property name.
module.exports = new Proxy(
    {},
    {
        get: (_target, prop) => (typeof prop === 'string' ? prop : undefined),
    }
);
