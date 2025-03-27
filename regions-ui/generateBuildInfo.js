import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const buildDate = new Date().toISOString();
const commitId = execSync('git rev-parse HEAD').toString().trim();
const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

const buildInfo = {
    buildDate,
    commitId,
    branchName,
};

writeFileSync('src/buildInfo.json', JSON.stringify(buildInfo, null, 2));
console.log('Build info generated:', buildInfo);

