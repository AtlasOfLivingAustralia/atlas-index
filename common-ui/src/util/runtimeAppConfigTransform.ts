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
 *
 * The source is parsed (TypeScript's parser, tolerant of syntax errors) rather than matched with a
 * regex, so only real member-expression nodes are rewritten: the same text inside a string, a
 * template's literal text, a regex or a comment is left alone.
 */

import ts from 'typescript';

const APP_KEY_RE = /^VITE_APP_[A-Z0-9_]+$/;

/** Alias used for the injected import, so it cannot clash with a name the file already imports. */
const HELPER = '__alaGetAppConfigValue';

function parse(code: string, fileName: string): ts.SourceFile {
    const file = fileName.split('?')[0];
    const kind = /\.tsx$/.test(file)
        ? ts.ScriptKind.TSX
        : /\.jsx$/.test(file)
          ? ts.ScriptKind.JSX
          : /\.[cm]?js$/.test(file)
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    return ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true, kind);
}

function isImportMetaEnv(node: ts.Node): node is ts.PropertyAccessExpression {
    return (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === 'env' &&
        ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
        node.expression.name.text === 'meta'
    );
}

/**
 * Rewrite every `import.meta.env.VITE_APP_*` in `code`, and prepend the import of the helper from
 * `helperPath` on the SAME first line, so line numbers in stack traces stay as they were. Returns
 * null when the file has no such reference, so the caller can leave it untouched. `fileName` only
 * selects the parser dialect (`.tsx`, `.jsx`, `.js`, otherwise `.ts`).
 */
export function rewriteAppEnvReferences(code: string, helperPath: string, fileName = 'module.tsx'): string | null {
    if (!code.includes('import.meta.env')) return null;
    const sf = parse(code, fileName);
    const edits: { start: number; end: number; key: string }[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node) && isImportMetaEnv(node.expression) && APP_KEY_RE.test(node.name.text)) {
            edits.push({ start: node.getStart(sf), end: node.end, key: node.name.text });
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    if (edits.length === 0) return null;
    let rewritten = code;
    for (const { start, end, key } of edits.reverse()) {
        rewritten = `${rewritten.slice(0, start)}${HELPER}('${key}', ${rewritten.slice(start, end)})${rewritten.slice(end)}`;
    }
    return `import { getAppConfigValue as ${HELPER} } from ${JSON.stringify(helperPath)};${rewritten}`;
}

/**
 * Forms of `import.meta.env` that `rewriteAppEnvReferences` cannot rewrite, so a `VITE_APP_*` read
 * that way would silently ignore config.js. The plugin fails the build on any of them, rather than
 * ship a portal where one key cannot be overridden.
 */
export function findUnsupportedAppEnvUsage(code: string, fileName = 'module.tsx'): string[] {
    if (!code.includes('import.meta.env')) return [];
    const sf = parse(code, fileName);
    const found = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (isImportMetaEnv(node)) {
            const parent = node.parent;
            if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
                // `import.meta.env.X`: supported (or an unrelated variable).
            } else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
                found.add('computed access: import.meta.env[...]');
            } else if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)) {
                const names = parent.name.elements.map((e) => (e.propertyName ?? e.name).getText(sf));
                if (names.some((n) => n.startsWith('VITE_APP_'))) {
                    found.add('destructuring: const { VITE_APP_... } = import.meta.env');
                }
            } else {
                found.add('import.meta.env used as a whole object');
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return [...found];
}
