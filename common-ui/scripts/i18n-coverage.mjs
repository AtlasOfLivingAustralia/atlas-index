/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * i18n coverage report (atlas-index#147, point (c): "Build or test time coverage reporting").
 *
 * For each UI passed as an argument it statically scans the source for react-intl message ids and
 * compares them against the bundled base catalogue (src/translations/en.json) and any per-locale
 * example catalogues (public/i18n/<code>.json):
 *
 *   - MISSING   : ids referenced in code but absent from en.json  -> fails the run (exit 1)
 *   - UNUSED    : keys in en.json never referenced in code        -> reported (search-ui keys are
 *                 partly data, so unused is informational, not a failure)
 *   - UNTRANSLATED per external locale: keys present in en.json but missing from that locale file
 *
 * Best-effort static analysis: ids built dynamically (template strings, computed keys) cannot be
 * detected and are not counted. Improving coverage / autogenerating missing keys is deferred tooling.
 *
 * Reports by default (exit 0). Pass --strict to fail (exit 1) when any MISSING key exists, e.g. to
 * gate CI once a UI's catalogue is complete; kept opt-in so pre-existing gaps don't block the build.
 *
 * Usage (from repo root):
 *   node common-ui/scripts/i18n-coverage.mjs occurrence-ui search-ui
 *   node common-ui/scripts/i18n-coverage.mjs --strict occurrence-ui
 */

import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, extname, resolve, basename} from 'node:path';

// How many missing ids to list before summarising (keeps `yarn test` output readable).
const MAX_LISTED = 10;

const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

// <FormattedMessage ... id="home.title" ...> (id may sit anywhere inside the opening tag)
const FORMATTED_MESSAGE_RE = /FormattedMessage[^>]*?\sid=["']([^"']+)["']/gs;
// intl.formatMessage({ id: 'home.searchPlaceholder', ... })
// NOTE: `defineMessages({...})` is NOT matched (the codebase does not use it today); add a pattern
// here if it is adopted, otherwise those ids would be silently missing from this report.
const FORMAT_MESSAGE_RE = /formatMessage\(\s*\{[^}]*?\bid:\s*["']([^"']+)["']/gs;

// Ids assembled at runtime. A static scan cannot know which keys these resolve to, so the keys they
// can reach must not be reported as unused:
//   `facet.${fieldName}`  /  'rank.' + result.taxonRank
const DYNAMIC_PREFIX_RE = [
    /[`"']([A-Za-z][\w.]*\.)\$\{/g, // template literal: `prefix.${...}`
    /["']([A-Za-z][\w.]*\.)["']\s*\+/g, // concatenation: 'prefix.' + variable
];
// Ids that are a bare variable (`id={fieldCode}`, `id={item.i18nCode}`): these can resolve to ANY
// key, so their presence means the unused count cannot be trusted at all.
const OPAQUE_ID_RE = /\bid=\{(?!['"`])\s*([A-Za-z_$][\w.$]*)/g;

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const s = statSync(full);
        if (s.isDirectory()) {
            if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
            out.push(...walk(full));
        } else if (SRC_EXT.has(extname(entry))) {
            out.push(full);
        }
    }
    return out;
}

function collectUsedIds(srcDir) {
    const ids = new Set();
    const dynamicPrefixes = new Set();
    const opaqueIds = new Set();
    for (const file of walk(srcDir)) {
        const text = readFileSync(file, 'utf8');
        for (const re of [FORMATTED_MESSAGE_RE, FORMAT_MESSAGE_RE]) {
            for (const match of text.matchAll(re)) ids.add(match[1]);
        }
        for (const re of DYNAMIC_PREFIX_RE) {
            for (const match of text.matchAll(re)) dynamicPrefixes.add(match[1]);
        }
        for (const match of text.matchAll(OPAQUE_ID_RE)) opaqueIds.add(match[1]);
    }
    return {ids, dynamicPrefixes, opaqueIds};
}

function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function reportUi(ui) {
    const srcDir = join(ui, 'src');
    const enPath = join(ui, 'src', 'translations', 'en.json');
    // `.` is how each UI's own `yarn i18n:coverage` invokes this, so label it by directory name.
    const label = basename(resolve(ui));
    if (!existsSync(srcDir) || !existsSync(enPath)) {
        console.log(`\n## ${label}\n  skipped: no src/ or src/translations/en.json`);
        return {missing: 0};
    }

    const {ids: used, dynamicPrefixes, opaqueIds} = collectUsedIds(srcDir);
    const base = loadJson(enPath);
    const baseKeys = new Set(Object.keys(base));

    const missing = [...used].filter((id) => !baseKeys.has(id)).sort();
    const reachedDynamically = (id) => [...dynamicPrefixes].some((p) => id.startsWith(p));
    const unreferenced = [...baseKeys].filter((id) => !used.has(id)).sort();
    const unused = unreferenced.filter((id) => !reachedDynamically(id));
    const viaDynamic = unreferenced.length - unused.length;

    console.log(`\n## ${label}`);
    console.log(`  used ids (static): ${used.size}`);
    console.log(`  en.json keys:      ${baseKeys.size}`);
    console.log(`  MISSING (used, not in en.json): ${missing.length}`);
    for (const id of missing.slice(0, MAX_LISTED)) console.log(`    - ${id}`);
    if (missing.length > MAX_LISTED) console.log(`    ... and ${missing.length - MAX_LISTED} more`);
    console.log(`  reachable via runtime-built ids (${dynamicPrefixes.size} prefixes): ${viaDynamic}`);
    console.log(`  UNUSED (no static reference and no matching prefix): ${unused.length}`);
    if (opaqueIds.size > 0) {
        // e.g. `id={item.i18nCode}` can resolve to any key at all, so "unused" cannot be trusted.
        console.log(
            `  ! ${opaqueIds.size} message id(s) come from a plain variable ` +
            `(${[...opaqueIds].slice(0, 4).join(', ')}${opaqueIds.size > 4 ? ', …' : ''}), which can ` +
            `resolve to any key: treat UNUSED as indicative only, never as a delete list.`
        );
    }

    // Per-locale example catalogues under public/i18n/
    const i18nDir = join(ui, 'public', 'i18n');
    if (existsSync(i18nDir)) {
        for (const f of readdirSync(i18nDir).filter((n) => n.endsWith('.json'))) {
            const code = f.replace(/\.json$/, '');
            if (code === 'en') continue;
            const locale = loadJson(join(i18nDir, f));
            const localeKeys = new Set(Object.keys(locale));
            const untranslated = [...baseKeys].filter((k) => !localeKeys.has(k));
            console.log(`  UNTRANSLATED in ${code} (example catalogue): ${untranslated.length}/${baseKeys.size}`);
        }
    }

    return {missing: missing.length};
}

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const uis = args.filter((a) => !a.startsWith('--'));
if (uis.length === 0) {
    console.error('Usage: node common-ui/scripts/i18n-coverage.mjs [--strict] <ui-dir> [<ui-dir> ...]');
    process.exit(2);
}

console.log('i18n coverage report');
let totalMissing = 0;
for (const ui of uis) totalMissing += reportUi(ui).missing;

console.log(`\nTotal MISSING keys across UIs: ${totalMissing}`);
process.exit(strict && totalMissing > 0 ? 1 : 0);
