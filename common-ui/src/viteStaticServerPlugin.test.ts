/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveStaticFilePath } from './viteStaticServerPlugin';

describe('resolveStaticFilePath', () => {
    let tmpRoot: string;
    let staticDir: string;
    let dataStaticDir: string;
    let dataGeneratedDir: string;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ala-static-server-test-'));
        staticDir = path.join(tmpRoot, 'static-server');
        dataStaticDir = path.join(tmpRoot, 'data-static');
        dataGeneratedDir = path.join(tmpRoot, 'data-generated');

        fs.mkdirSync(path.join(staticDir, 'static', 'common'), { recursive: true });
        fs.mkdirSync(path.join(staticDir, 'static', 'dashboard'), { recursive: true });
        fs.mkdirSync(path.join(dataStaticDir, 'dashboard'), { recursive: true });
        fs.mkdirSync(path.join(dataGeneratedDir, 'taxon-map', '13'), { recursive: true });

        fs.writeFileSync(path.join(staticDir, 'static', 'common', 'banner.mustache'), 'banner');
        fs.writeFileSync(path.join(staticDir, 'static', 'dashboard', 'dashboardI18n.json'), '{}');
        fs.writeFileSync(path.join(dataStaticDir, 'dashboard', 'dashboard.json'), '{"count":1}');
        fs.writeFileSync(path.join(dataGeneratedDir, 'taxon-map', '13', 'taxon_map.json'), '{"occurrenceCount":942457}');
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('resolves git-tracked files from static-server/static first', () => {
        const res = resolveStaticFilePath('/static/common/banner.mustache', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(res).toEqual({
            status: 'ok',
            filePath: path.join(staticDir, 'static', 'common', 'banner.mustache')
        });
    });

    it('falls back to extraStaticDirs for generated taxon-map and dashboard files without symlinks', () => {
        const mapRes = resolveStaticFilePath('/static/taxon-map/13/taxon_map.json', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(mapRes).toEqual({
            status: 'ok',
            filePath: path.join(dataGeneratedDir, 'taxon-map', '13', 'taxon_map.json')
        });

        const dashI18n = resolveStaticFilePath('/static/dashboard/dashboardI18n.json', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(dashI18n).toEqual({
            status: 'ok',
            filePath: path.join(staticDir, 'static', 'dashboard', 'dashboardI18n.json')
        });

        const dashJson = resolveStaticFilePath('/static/dashboard/dashboard.json', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(dashJson).toEqual({
            status: 'ok',
            filePath: path.join(dataStaticDir, 'dashboard', 'dashboard.json')
        });
    });

    it('returns forbidden on path traversal outside root', () => {
        const res = resolveStaticFilePath('/static/../../../etc/passwd', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(res).toEqual({ status: 'forbidden' });
    });

    it('returns not_found when file is absent from all roots', () => {
        const res = resolveStaticFilePath('/static/taxon-map/missing.json', staticDir, [dataStaticDir, dataGeneratedDir]);
        expect(res).toEqual({ status: 'not_found' });
    });
});
