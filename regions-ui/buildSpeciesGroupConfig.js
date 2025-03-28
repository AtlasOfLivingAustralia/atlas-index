import { writeFileSync, readFileSync } from 'fs';

// convert the namematching service's speciesGroups.json to a more suitable format for the speciesView refine section
const speciesGroups = JSON.parse(readFileSync('./public/speciesGroups.json', 'utf8'));
const speciesGroupsMap = {};

function convertSpeciesGroups() {
    console.log('speciesGroupMap.json rebuilding...');
    speciesGroups.forEach((group) => {
        if (!group.parent) {
            var itemChildren = getChildren(group.name);
            if (itemChildren.length > 0) {
                speciesGroupsMap[group.name] = {name: group.name, children: itemChildren};
            } else {
                speciesGroupsMap[group.name] = {name: group.name};
            }
        }
    })

    // write speciesGroupsMap to ./public/speciesGroupsMap.json
    writeFileSync('./src/config/speciesGroupsMap.json', JSON.stringify(speciesGroupsMap, null, 2));
    console.log('./src/config/speciesGroupsMap.json done');
}

function getChildren(parent) {
    var children = [];
    speciesGroups.forEach((group) => {
        if (group.parent == parent) {

            var itemChildren = getChildren(group.name);
            if (itemChildren.length > 0) {
                children.push({ name: group.name, children: itemChildren });
            } else {
                children.push({ name: group.name});
            }
        }
    });
    return children;
}

convertSpeciesGroups();

