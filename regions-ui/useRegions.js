/**
 * Copies the current regionsList-{hash}.json to the assets folder.
 *
 * Intended to be called during the "yarn run build" process only.
 */

import {readFileSync, writeFileSync} from 'fs';
import { execSync } from 'child_process';

// get the first argument from the command line
const mode = process.argv[2] || 'build';

// playwright mode uses a fixed regionsList.json file. Copy it then exit.
if (mode === 'playwright') {
    console.log('Running in playwright mode, using fixed regionsList.json');
    writeFileSync('./dist/assets/regionsList.json', readFileSync('./tests/resources/regionsList.json', 'utf8'));
    console.log('Copied regionsList.json to dist/assets/ from test/resources/regionsList.json');
    process.exit(0);
}

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
