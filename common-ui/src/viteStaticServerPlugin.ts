/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * viteStaticServerPlugin
 *
 * Local dev convenience: for local development .env.local files reference
 * `http://localhost:8082/static/...` (header/footer/css/js, banner messages,
 * etc.)
 *
 * This plugin spawns a minimal static file server on that same port,
 * serving the `static-server` directory itself (resolved as a sibling of
 * the app's project root)
 *
 * - Only runs for `vite dev` (the `serve` command), never for `vite build`.
 * - If the port is already in use (e.g. static-server is already running
 *   manually, or another app's dev server already started it), it logs a
 *   notice and leaves the existing server alone rather than failing.
 * - Stops its server when the vite dev server closes.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface ViteStaticServerPluginOptions {
    /** Port to serve static-server content on. Defaults to 8082. */
    port?: number;
    /**
     * Path to the static-server directory, relative to the vite project
     * root. Defaults to `../static-server`, matching the standard monorepo
     * layout where each `-ui` app is a sibling of `static-server`.
     */
    staticDir?: string;
}

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.mustache': 'text/plain; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8'
};

function contentTypeFor(filePath: string): string {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function viteStaticServerPlugin(options: ViteStaticServerPluginOptions = {}): Plugin {
    const port = options.port ?? 8082;

    return {
        name: 'ala-static-server',
        apply: 'serve',

        configureServer(server) {
            const root = server.config.root;
            const staticDir = path.resolve(root, options.staticDir ?? '../static-server');

            if (!fs.existsSync(staticDir)) {
                console.warn(`[ala-static-server] static directory not found at ${staticDir}, skipping.`);
                return;
            }

            const staticServer = http.createServer((req, res) => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
                let filePath = path.join(staticDir, urlPath);

                // prevent path traversal outside of staticDir
                if (!filePath.startsWith(staticDir)) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }

                fs.stat(filePath, (err, stat) => {
                    if (!err && stat.isDirectory()) {
                        filePath = path.join(filePath, 'index.html');
                    }

                    fs.readFile(filePath, (readErr, data) => {
                        if (readErr) {
                            res.writeHead(404);
                            res.end('Not found');
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
                        res.end(data);
                    });
                });
            });

            staticServer.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`[ala-static-server] port ${port} already in use, assuming static-server is already running.`);
                } else {
                    console.warn(`[ala-static-server] failed to start: ${err.message}`);
                }
            });

            staticServer.listen(port, () => {
                console.log(`[ala-static-server] serving ${staticDir} at http://localhost:${port}/static/`);
            });

            server.httpServer?.once('close', () => {
                staticServer.close();
            });
        }
    };
}
