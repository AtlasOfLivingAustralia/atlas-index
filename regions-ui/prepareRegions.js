/**
 * This will generate a regionsList.json file, if missing. It will use the VITE_SPATIAL_URL from the .env.production.
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

// read .env.production
let env;
let envObj;
try {
    env = readFileSync('.env.production', 'utf8');
    const envLines = env.split('\n');
    envObj = {};
    envLines.forEach((line) => {
        const parts = line.split('=');
        if (parts.length === 2) {
            envObj[parts[0].trim()] = parts[1].trim();
        }
    });
} catch (e) {
    console.error('Error: Failed to read "./.env.production". Cannot build without this file. \n\nFor local development (yarn run dev): \n 1. manually run "node buildRegions.js {spatialBaseUrl}"\n 2. update .env.local\'s VITE_REGIONS_CONFIG_URL to refer to the produced regionsList-{hash}.json\n\n');
    process.exit(1);
}
// get the VITE_SPATIAL_URL from the .env.production
const baseSpatialUrl = envObj['VITE_SPATIAL_WS_URL'];
if (!baseSpatialUrl) {
    console.error('VITE_SPATIAL_WS_URL not found in .env.production');
    process.exit(1);
}

// check meta vs VITE_SPATIAL_URL
if (regionsMeta.baseSpatialUrl !== baseSpatialUrl) {
    console.log('VITE_SPATIAL_WS_URL changed. Rebuilding regionsList.json with new baseSpatialUrl:', baseSpatialUrl);

    // run "node buildRegions.js <baseSpatialUrl>"
    execSync(`node buildRegions.js ${baseSpatialUrl}`, { stdio: 'inherit' });

    // re-read meta
    regionsMeta = JSON.parse(readFileSync('./regionsList.meta.json', 'utf8'));
}

// check if regionsList-{hash}.json exists
const regionsListFile = regionsMeta.file;
try {
    readFileSync(regionsListFile);
} catch (error) {
    console.error(`Failed to read regionsList.json, was there a problem running "node buildRegions.js ${baseSpatialUrl}"?`, error);
    process.exit(1);
}

// success, write updated .env.production
const newEnv = env.replace(/VITE_REGIONS_CONFIG_URL=.*/, `VITE_REGIONS_CONFIG_URL=./assets/${regionsListFile}`);
writeFileSync('.env.production', newEnv, 'utf8');

console.log(`Updated .env.production with new VITE_REGIONS_CONFIG_URL: ./assets/${regionsListFile} modified: ${regionsMeta.modified}`);



