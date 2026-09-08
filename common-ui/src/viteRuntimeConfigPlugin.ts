/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * viteRuntimeConfigPlugin
 *
 * Picks one of the two build profiles:
 *
 *   ALA build (default)  adds nothing. The `<script src="/config.js">` tag is removed from
 *                        index.html and `community/` is not copied to the output.
 *   LA Community build   with `VITE_RUNTIME_CONFIG_ENABLED=true` (see `.env.community` and
 *                        `yarn build:community`) the tag stays and `community/` is copied, so a
 *                        deployer can set the portal name, the translations and so on afterwards.
 *
 * `community/` is outside `public/` on purpose, because Vite copies `public/` into every build.
 * Both profiles are built from the same code and the same commit; the difference is the build
 * configuration, not a fork.
 *
 * The HTML decision lives in `util/runtimeConfigHtml` so it can be unit tested without Vite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';
import { isRuntimeConfigEnabled, stripRuntimeConfigScript, RUNTIME_CONFIG_FLAG } from './util/runtimeConfigHtml.ts';

export { RUNTIME_CONFIG_FLAG, isRuntimeConfigEnabled, stripRuntimeConfigScript } from './util/runtimeConfigHtml.ts';

/** Directory holding the files a runtime-configured deployment serves, relative to the app root. */
export const COMMUNITY_DIR = 'community';

/** Flag read by the apps to decide whether the header language selector is compiled in. */
export const LANGUAGE_SWITCHER_FLAG = 'VITE_HEADER_LANGUAGE_SWITCHER_ENABLED';

/**
 * Off unless a build profile says otherwise. These are applied to `process.env` before the build
 * starts so that an existing deployment, whose .env predates these flags and therefore does not
 * mention them, keeps building: viteEnvCheckPlugin fails a build whose source references a VITE_
 * variable the env does not define, and `loadEnv` reads `process.env` as well as the .env files.
 */
const FLAG_DEFAULTS: Record<string, string> = {
    [RUNTIME_CONFIG_FLAG]: 'false',
    [LANGUAGE_SWITCHER_FLAG]: 'false'
};

function copyDir(from: string, to: string) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isDirectory()) {
            copyDir(src, dest);
        } else if (entry.isFile()) {
            fs.copyFileSync(src, dest);
        }
    }
}

export function viteRuntimeConfigPlugin(): Plugin {
    let resolvedConfig: ResolvedConfig;
    let enabled = false;
    let communityDir = '';

    return {
        name: 'ala-runtime-config',

        config(userConfig, { mode }) {
            const root = userConfig.root ?? process.cwd();
            const env = loadEnv(mode, root, '');
            for (const [key, value] of Object.entries(FLAG_DEFAULTS)) {
                if (!(key in env)) process.env[key] = value;
            }
        },

        configResolved(config) {
            resolvedConfig = config;
            enabled = isRuntimeConfigEnabled(loadEnv(config.mode, config.root, ''));
            communityDir = path.resolve(config.root, COMMUNITY_DIR);
            // Say which profile this is. Both come out of the same directory, so without a line in
            // the log there is no way to tell one output from the other at a glance.
            config.logger.info(
                enabled
                    ? '[ala-runtime-config] LA Community build: config.js kept, community/ copied'
                    : '[ala-runtime-config] ALA build: no runtime configuration'
            );
        },

        // `order: 'pre'` matters: Vite's own HTML plugin inspects <script> tags and warns about
        // `/config.js` not being a module. The tag has to be gone before that runs.
        transformIndexHtml: {
            order: 'pre',
            handler(html: string) {
                return enabled ? html : stripRuntimeConfigScript(html);
            }
        },

        // `community/` sits outside publicDir, so the dev server has to serve it explicitly.
        configureServer(server) {
            if (!enabled || !fs.existsSync(communityDir)) return;
            server.middlewares.use((req, res, next) => {
                const url = (req.url ?? '').split('?')[0];
                const file = path.resolve(communityDir, `.${path.posix.normalize(url)}`);
                // `path.relative` rather than `startsWith`: the latter also accepts a sibling whose
                // name merely starts with the directory's, e.g. `<root>/community-other/secret`.
                const inside = path.relative(communityDir, file);
                if (inside.startsWith('..') || path.isAbsolute(inside)) return next();
                if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
                if (file.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
                if (file.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
                res.end(fs.readFileSync(file));
            });
        },

        closeBundle() {
            if (!enabled || !fs.existsSync(communityDir)) return;
            copyDir(communityDir, path.resolve(resolvedConfig.root, resolvedConfig.build.outDir));
        }
    };
}
