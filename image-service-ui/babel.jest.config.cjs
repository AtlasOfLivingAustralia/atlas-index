/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Babel config used only by Jest (via jest.config.ts transform option).
// Vite uses its own transform pipeline and does not read this file, so this
// does not affect the production/dev build.
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
    ],
    plugins: ['./babel-plugin-transform-import-meta.cjs'],
};
