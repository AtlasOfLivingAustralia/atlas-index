/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Builds a one-file fixture with the real plugin (in a child process, Vite being ESM) and runs the
 * output, to check what the unit tests cannot: that the LA Community build lets config.js override
 * any VITE_APP_* without the source naming it, and that the ALA build is left alone.
 */

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fixture = path.resolve(__dirname, '../test/app-config-fixture');
const vite = path.resolve(__dirname, '../../node_modules/vite/bin/vite.js');

function build(community: boolean, entry = 'src/main.ts') {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ala-app-config-'));
    const result = spawnSync(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir'], {
        cwd: fixture,
        encoding: 'utf-8',
        env: {
            ...process.env,
            FIXTURE_ENTRY: entry,
            VITE_RUNTIME_CONFIG_ENABLED: String(community),
            VITE_APP_API_URL: 'http://build-default',
            VITE_SKIN: 'ALA'
        }
    });
    const file = path.join(outDir, 'out.js');
    return {status: result.status, stderr: `${result.stderr}${result.stdout}`, code: fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''};
}

/** Runs a built bundle against a fake `window` carrying the given runtime config. */
function run(code: string, local?: Record<string, string>) {
    const win: Record<string, unknown> = local ? {APP_CONFIG_LOCAL: local} : {};
    new Function('window', code)(win);
    return win.__result as {api: string; skin: string};
}

jest.setTimeout(60000);

describe('viteRuntimeConfigPlugin app config rewrite', () => {
    it('LA Community build: the build value is the default', () => {
        const {status, code} = build(true);
        expect(status).toBe(0);
        expect(run(code)).toEqual({api: 'http://build-default', skin: 'ALA'});
    });

    it('LA Community build: config.local.js overrides a VITE_APP_* the source never names', () => {
        const {code} = build(true);
        expect(run(code, {VITE_APP_API_URL: 'http://runtime-override', VITE_SKIN: 'IGNORED'})).toEqual({
            api: 'http://runtime-override',
            skin: 'ALA'
        });
    });

    it('ALA build: nothing is rewritten, so config.js has no effect', () => {
        const {code} = build(false);
        expect(code).not.toContain('APP_CONFIG');
        expect(run(code, {VITE_APP_API_URL: 'http://runtime-override'}).api).toBe('http://build-default');
    });

    it('LA Community build fails on a form that cannot be overridden', () => {
        const {status, stderr} = build(true, 'src/bad.ts');
        expect(status).not.toBe(0);
        expect(stderr).toContain('destructuring');
    });

    it('ALA build does not enforce that rule', () => {
        expect(build(false, 'src/bad.ts').status).toBe(0);
    });
});
