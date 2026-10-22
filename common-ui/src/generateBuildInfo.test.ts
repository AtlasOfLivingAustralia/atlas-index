/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runs generateBuildInfo.js in a throwaway git repo shaped like a UI package, to check that the
 * build info lands both where App.tsx imports it and where Vite serves/copies it (public/).
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.resolve(__dirname, '../generateBuildInfo.js');

function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, {cwd, encoding: 'utf-8'}).trim();
}

describe('generateBuildInfo.js', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ala-build-info-'));
        fs.mkdirSync(path.join(dir, 'src'));
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({version: '1.2.3'}));
        git(dir, 'init', '-q', '-b', 'test-branch');
        git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    });

    afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

    it('writes the same build info to src/ and to public/, creating public/ if missing', () => {
        execFileSync(process.execPath, [script], {cwd: dir});

        const src = fs.readFileSync(path.join(dir, 'src/buildInfo.json'), 'utf-8');
        const pub = fs.readFileSync(path.join(dir, 'public/buildInfo.json'), 'utf-8');
        expect(pub).toBe(src);

        const info = JSON.parse(pub);
        expect(info).toEqual({
            buildDate: expect.any(String),
            commit: git(dir, 'rev-parse', 'HEAD'),
            branch: 'test-branch',
            version: '1.2.3'
        });
        expect(Number.isNaN(Date.parse(info.buildDate))).toBe(false);
    });
});
