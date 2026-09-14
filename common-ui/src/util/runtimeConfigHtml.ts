/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Pure helpers behind viteRuntimeConfigPlugin, kept free of any Vite import so they can be unit
 * tested directly (Vite ships as ESM and is not loadable from the Jest setup here).
 *
 * They decide whether `index.html` keeps its `<script src="/config.js">` tag. The LA Community
 * build keeps it, so a deployer can change settings after the build. The ALA build removes it.
 * Which build you get depends on the build configuration (`.env.community`), not on a fork.
 */

export const RUNTIME_CONFIG_FLAG = 'VITE_RUNTIME_CONFIG_ENABLED';

/**
 * Matches the script tags and the comment above them, so removing one does not leave the other
 * behind. It only matches `config.js` and `config.local.js` at the site root, nothing else.
 *
 * Anchored per line and stopping at the newline, so the indentation of the FOLLOWING line survives:
 * the ALA build's page has to match the source page character for character once the tag is gone,
 * not merely look the same.
 */
const CONFIG_SCRIPT_LINE_RE =
    /^[ \t]*(?:<!--(?:(?!-->)[\s\S])*?-->[ \t]*\r?\n[ \t]*)?<script\s+src=(["'])\/config(?:\.local)?\.js\1\s*><\/script>[ \t]*\r?\n?/gim;

/** Fallback for a tag that is not alone on its line, where indentation cannot be preserved anyway. */
const CONFIG_SCRIPT_INLINE_RE = /[ \t]*<script\s+src=(["'])\/config(?:\.local)?\.js\1\s*><\/script>/gi;

/** True when the resolved env opts this build into runtime configuration. */
export function isRuntimeConfigEnabled(env: Record<string, string | undefined>): boolean {
    return env[RUNTIME_CONFIG_FLAG] === 'true';
}

/**
 * Remove the runtime-config script tag from an HTML document. Returns the input unchanged when the
 * tag is absent, so running it twice is safe.
 */
export function stripRuntimeConfigScript(html: string): string {
    return html.replace(CONFIG_SCRIPT_LINE_RE, '').replace(CONFIG_SCRIPT_INLINE_RE, '');
}
