/**
 * generateSpeciesGroupsMap.js
 *
 * Converts flat public/speciesGroups.json into src/config/speciesGroupsMap.json (generated — do not edit by hand)
 *
 * Run automatically as part of the `dev` and `build` scripts in package.json.
 */

import { writeFileSync, readFileSync } from 'fs';

const INPUT  = './public/speciesGroups.json';
const OUTPUT = './src/config/speciesGroupsMap.json';

const speciesGroups = JSON.parse(readFileSync(INPUT, 'utf8'));
const speciesGroupsMap = {};

function getChildren(parent) {
    const children = [];
    speciesGroups.forEach((group) => {
        if (group.parent === parent) {
            const itemChildren = getChildren(group.name);
            if (itemChildren.length > 0) {
                children.push({ name: group.name, children: itemChildren });
            } else {
                children.push({ name: group.name });
            }
        }
    });
    return children;
}

speciesGroups.forEach((group) => {
    if (!group.parent) {
        const itemChildren = getChildren(group.name);
        if (itemChildren.length > 0) {
            speciesGroupsMap[group.name] = { name: group.name, children: itemChildren };
        } else {
            speciesGroupsMap[group.name] = { name: group.name };
        }
    }
});

writeFileSync(OUTPUT, JSON.stringify(speciesGroupsMap, null, 4));
console.log(`${OUTPUT} rebuilt from ${INPUT}`);
