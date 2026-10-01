/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Pure source rewrite behind viteRuntimeConfigPlugin's LA Community build, kept free of any Vite
 * import so it can be unit tested directly.
 *
 * `import.meta.env.VITE_APP_X` becomes `getAppConfigValue('VITE_APP_X', import.meta.env.VITE_APP_X)`,
 * so Vite still inlines the build's own value as the fallback while `config.js`/`config.local.js`
 * can override it (see runtimeAppConfig.ts).
 */

const APP_ENV_RE = /import\.meta\.env\.(VITE_APP_[A-Z0-9_]+)(?![A-Za-z0-9_])/g;

/** Alias used for the injected import, so it cannot clash with a name the file already imports. */
const HELPER = '__alaGetAppConfigValue';

/**
 * Rewrite every `import.meta.env.VITE_APP_*` in `code`, and prepend the import of the helper from
 * `helperPath` on the SAME first line, so line numbers in stack traces stay as they were. Returns
 * null when the file has no such reference, so the caller can leave it untouched.
 */
export function rewriteAppEnvReferences(code: string, helperPath: string): string | null {
    let found = false;
    const rewritten = code.replace(APP_ENV_RE, (match, key: string) => {
        found = true;
        return `${HELPER}('${key}', ${match})`;
    });
    if (!found) return null;
    return `import { getAppConfigValue as ${HELPER} } from ${JSON.stringify(helperPath)};${rewritten}`;
}
