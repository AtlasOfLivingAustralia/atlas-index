/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * viteEnvCheckPlugin
 *
 * Scans all source files (*.ts, *.tsx, *.js, *.jsx) under `src/` for
 * `import.meta.env.VITE_*` references and verifies every referenced variable
 * is present (defined) in the resolved Vite env for the current mode.
 * Empty values are allowed — only missing (undefined) keys are flagged.
 *
 * - `vite build`: hard error — build fails immediately.
 * - `vite dev`:   warning — printed to console but server still starts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';

const ENV_VAR_RE = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;
const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.yarn']);

function scanDir(dir: string): Set<string> {
    const found = new Set<string>();
    if (!fs.existsSync(dir)) return found;

    const walk = (current: string) => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && SOURCE_EXT_RE.test(entry.name)) {
                const content = fs.readFileSync(full, 'utf-8');
                let match: RegExpExecArray | null;
                ENV_VAR_RE.lastIndex = 0;
                while ((match = ENV_VAR_RE.exec(content)) !== null) {
                    found.add(match[1]);
                }
            }
        }
    };

    walk(dir);
    return found;
}

export function viteEnvCheckPlugin(): Plugin {
    let resolvedConfig: ResolvedConfig;

    return {
        name: 'ala-env-check',

        configResolved(config) {
            resolvedConfig = config;
        },

        buildStart() {
            const { mode, root, command } = resolvedConfig;
            const env = loadEnv(mode, root, '');
            const srcDir = path.join(root, 'src');
            const used = scanDir(srcDir);

            const missing = [...used].filter(key => !(key in env));

            if (missing.length === 0) return;

            const lines = missing.map(k => `  • ${k}`).join('\n');
            const msg = `[ala-env-check] ${missing.length} env var(s) referenced in source but ` + `missing for mode "${mode}":\n${lines}\n` + `  Check your .env.${mode} / .env.local files.`;

            if (command === 'build') {
                throw new Error(msg);
            } else {
                // dev — warn but don't block dev
                console.warn(`\n${msg}\n`);
            }
        }
    };
}
