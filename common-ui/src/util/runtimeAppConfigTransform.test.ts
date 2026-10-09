/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {findUnsupportedAppEnvUsage, rewriteAppEnvReferences} from './runtimeAppConfigTransform';

const helper = '/repo/common-ui/src/util/runtimeAppConfig.ts';

describe('rewriteAppEnvReferences', () => {
    it('returns null when the file has no VITE_APP_ reference', () => {
        expect(rewriteAppEnvReferences('const a = import.meta.env.VITE_SKIN;', helper)).toBeNull();
    });

    it('wraps a reference, keeping the original as the fallback', () => {
        const out = rewriteAppEnvReferences('fetch(import.meta.env.VITE_APP_BIOCACHE_URL + "/x");', helper)!;
        expect(out).toContain(
            "__alaGetAppConfigValue('VITE_APP_BIOCACHE_URL', import.meta.env.VITE_APP_BIOCACHE_URL) + \"/x\""
        );
    });

    it('wraps every reference, including several on one line and in template literals', () => {
        const out = rewriteAppEnvReferences(
            'a(import.meta.env.VITE_APP_API_URL, import.meta.env.VITE_APP_BASE_URL); `${import.meta.env.VITE_APP_API_URL}/x`',
            helper
        )!;
        expect(out.match(/__alaGetAppConfigValue\('/g)).toHaveLength(3);
    });

    it('does not touch other VITE_ variables or longer names that merely start the same', () => {
        const out = rewriteAppEnvReferences(
            'import.meta.env.VITE_APP_API_URL; import.meta.env.VITE_SKIN; import.meta.env.VITE_COMMON_HEADER_URL;',
            helper
        )!;
        expect(out).toContain('import.meta.env.VITE_SKIN;');
        expect(out).toContain('import.meta.env.VITE_COMMON_HEADER_URL;');
        expect(out.match(/__alaGetAppConfigValue\('/g)).toHaveLength(1);
    });

    it('prepends the import on the first line so line numbers do not move', () => {
        const out = rewriteAppEnvReferences('// header\nconst u = import.meta.env.VITE_APP_API_URL;', helper)!;
        expect(out.split('\n')).toHaveLength(2);
        expect(out.startsWith(`import { getAppConfigValue as __alaGetAppConfigValue } from "${helper}";// header`)).toBe(true);
    });

    it('leaves the key untouched inside strings, template text, regexes and comments', () => {
        const src = [
            "const a = 'import.meta.env.VITE_APP_API_URL';",
            'const b = "import.meta.env.VITE_APP_API_URL";',
            'const c = `docs: import.meta.env.VITE_APP_API_URL`;',
            'const d = /import\\.meta\\.env\\.VITE_APP_API_URL/;',
            '// import.meta.env.VITE_APP_API_URL',
            '/* import.meta.env.VITE_APP_API_URL */',
        ].join('\n');
        expect(rewriteAppEnvReferences(src, helper)).toBeNull();
    });

    it('rewrites only the real reference when text and code mix', () => {
        const out = rewriteAppEnvReferences(
            "const a = 'import.meta.env.VITE_APP_API_URL'; const b = import.meta.env.VITE_APP_API_URL; // import.meta.env.VITE_APP_API_URL",
            helper
        )!;
        expect(out.match(/__alaGetAppConfigValue\('/g)).toHaveLength(1);
        expect(out).toContain("const a = 'import.meta.env.VITE_APP_API_URL';");
        expect(out).toContain('; // import.meta.env.VITE_APP_API_URL');
    });

    it('rewrites a reference inside a template substitution and in JSX', () => {
        const out = rewriteAppEnvReferences(
            "const u = `x ${import.meta.env.VITE_APP_API_URL} y`; const el = <a href={import.meta.env.VITE_APP_BASE_URL}>Don't</a>;",
            helper
        )!;
        expect(out.match(/__alaGetAppConfigValue\('/g)).toHaveLength(2);
    });

    it('handles .ts sources with type assertions', () => {
        const out = rewriteAppEnvReferences('const u = <string>import.meta.env.VITE_APP_API_URL;', helper, 'a.ts')!;
        expect(out).toContain("<string>__alaGetAppConfigValue('VITE_APP_API_URL', import.meta.env.VITE_APP_API_URL)");
    });
});

describe('findUnsupportedAppEnvUsage', () => {
    it('accepts the literal form and other env variables', () => {
        expect(findUnsupportedAppEnvUsage('a(import.meta.env.VITE_APP_API_URL, import.meta.env.MODE);')).toEqual([]);
    });

    it('flags computed access, destructuring and whole-object use', () => {
        expect(findUnsupportedAppEnvUsage('const v = import.meta.env[key];')).toHaveLength(1);
        expect(findUnsupportedAppEnvUsage('const { VITE_APP_API_URL } = import.meta.env;').length).toBeGreaterThan(0);
        expect(findUnsupportedAppEnvUsage('const env = import.meta.env;')).toHaveLength(1);
        expect(findUnsupportedAppEnvUsage('f(import.meta.env)')).toHaveLength(1);
    });

    it('ignores prose in comments', () => {
        expect(findUnsupportedAppEnvUsage('// reads import.meta.env\n/* const x = import.meta.env[k] */')).toEqual([]);
    });

    it('ignores unsupported-looking text inside strings, templates and regexes', () => {
        const src = [
            "const a = 'const env = import.meta.env;';",
            'const b = `f(import.meta.env[k])`;',
            'const c = /import.meta.env[k]/;',
        ].join('\n');
        expect(findUnsupportedAppEnvUsage(src)).toEqual([]);
    });

    it('does not flag destructuring of non-VITE_APP_ keys', () => {
        expect(findUnsupportedAppEnvUsage('const { MODE, DEV } = import.meta.env;')).toEqual([]);
    });
});
