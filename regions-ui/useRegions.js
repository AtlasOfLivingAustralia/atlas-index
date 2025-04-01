/**
 * Copies the current regionsList-{hash}.json to the assets folder.
 *
 * Intended to be called during the "yarn run build" process only.
 */

import {readFileSync, writeFileSync} from 'fs';
import { execSync } from 'child_process';

// read ./regionsList.meta.json to an object
let regionsMeta;
try {
    regionsMeta = JSON.parse(readFileSync('./regionsList.meta.json', 'utf8'));
} catch (error) {
    console.warn('Warning: Failed to read regionsList.meta.json, using empty object.\n');
    regionsMeta = {};
}

// write the regionsMeta.file to the assets folder
const content = readFileSync('./' + regionsMeta.file, 'utf8');
writeFileSync('./dist/assets/' + regionsMeta.file, content);

console.log(`Copied ${regionsMeta.file} to dist/assets/`);
