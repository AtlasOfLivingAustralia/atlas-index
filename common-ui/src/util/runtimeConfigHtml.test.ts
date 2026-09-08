/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    RUNTIME_CONFIG_FLAG,
    isRuntimeConfigEnabled,
    stripRuntimeConfigScript
} from './runtimeConfigHtml';

const PAGE = `<!doctype html>
<html lang="en">
    <body>
        <div id="root"></div>
        <!-- Runtime config: classic scripts run before the deferred module. -->
        <script src="/config.js"></script>
        <script src="/config.local.js"></script>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
`;

describe('isRuntimeConfigEnabled', () => {
    it('is enabled only for the exact string "true"', () => {
        expect(isRuntimeConfigEnabled({ [RUNTIME_CONFIG_FLAG]: 'true' })).toBe(true);
        expect(isRuntimeConfigEnabled({ [RUNTIME_CONFIG_FLAG]: 'false' })).toBe(false);
        expect(isRuntimeConfigEnabled({ [RUNTIME_CONFIG_FLAG]: '1' })).toBe(false);
        expect(isRuntimeConfigEnabled({ [RUNTIME_CONFIG_FLAG]: '' })).toBe(false);
    });

    it('defaults to disabled when the flag is absent, which is the ALA build', () => {
        expect(isRuntimeConfigEnabled({})).toBe(false);
    });
});

describe('stripRuntimeConfigScript', () => {
    it('removes both config tags and the comment above them', () => {
        const out = stripRuntimeConfigScript(PAGE);
        expect(out).not.toContain('/config.js');
        expect(out).not.toContain('/config.local.js');
        expect(out).not.toContain('Runtime config');
    });

    it('removes the config.js tag and the comment documenting it', () => {
        const out = stripRuntimeConfigScript(PAGE);
        expect(out).not.toContain('/config.js');
        expect(out).not.toContain('Runtime config');
    });

    it('leaves the application entry point alone', () => {
        expect(stripRuntimeConfigScript(PAGE)).toContain('<script type="module" src="/src/main.tsx"></script>');
    });

    it('leaves the ALA build page character-for-character equal to the source page', () => {
        const before = `<!doctype html>
<html lang="en">
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
`;
        const withTag = `<!doctype html>
<html lang="en">
    <body>
        <div id="root"></div>
        <!-- Runtime config: classic scripts run before the deferred module. -->
        <script src="/config.js"></script>
        <script src="/config.local.js"></script>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
`;
        expect(stripRuntimeConfigScript(withTag)).toBe(before);
    });

    it('is a no-op on a page that has no runtime config tag', () => {
        const stripped = stripRuntimeConfigScript(PAGE);
        expect(stripRuntimeConfigScript(stripped)).toBe(stripped);
    });

    it('handles single quotes and no surrounding comment', () => {
        const html = `<body><script src='/config.js'></script><script type="module" src="/src/main.tsx"></script></body>`;
        const out = stripRuntimeConfigScript(html);
        expect(out).not.toContain('/config.js');
        expect(out).toContain('/src/main.tsx');
    });

    it('does not touch other scripts served from the root', () => {
        const html = `<script src="/other-config.js"></script>`;
        expect(stripRuntimeConfigScript(html)).toBe(html);
    });
});
