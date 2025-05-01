import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const buildDate = new Date().toISOString();
const commit = execSync('git rev-parse HEAD').toString().trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

const buildInfo = {
    buildDate,
    commit,
    branch,
};

writeFileSync('src/buildInfo.json', JSON.stringify(buildInfo, null, 2));
console.log('Build info generated:', buildInfo);

