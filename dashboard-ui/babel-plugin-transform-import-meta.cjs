/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Minimal babel plugin used only for Jest so that `import.meta.env.X` in
// source files (used by Vite at build/dev time) can run under Jest's
// CommonJS environment. It rewrites `import.meta.env` to `process.env`.
// This does not affect the Vite build, which never uses this plugin.
module.exports = function transformImportMeta() {
    return {
        visitor: {
            MetaProperty(path) {
                const parent = path.parentPath;
                if (
                    parent.isMemberExpression() &&
                    parent.node.property.name === 'env'
                ) {
                    parent.replaceWithSourceString('process.env');
                }
            },
        },
    };
};
