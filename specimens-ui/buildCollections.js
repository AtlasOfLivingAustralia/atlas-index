import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {existsSync} from "node:fs";

// The location of the resource configuration file (URL or local path)
const resourceConfigurationUrl = './resources/collections.json';
// The location of the collectory web services
const collectoryServicesUrl = 'https://collections.ala.org.au/ws';
// The mappings from collectory UIDs to resource types
const resourceMappings = [
    { prefix: 'co', path: 'collection' },
    { prefix: 'dr', path: 'dataResource' }
];
const resourcesFile = './src/api/sources/collections.json';
// The list of resource metadata for each resource that is displayed
let resources = [];

if (existsSync(resourcesFile)) {
    console.log(`Resource file ${resourcesFile} already exists. Using the existing file.`);
    process.exit(0);
}

/**
 * Get the path to the resource in the collectory, based on the resource UID prefix
 * @param {string} uid
 * @returns {string}
 */
function resourcePath(uid) {
    const mapping = resourceMappings.find(m => uid.startsWith(m.prefix));
    if (mapping) {
        return mapping.path;
    }
    throw new Error(`Unable to find collectory path for ${uid}`);
}

/**
 * Collect the resource information
 */
async function buildResources() {
    resources = [];
    // Load the collections to render
    const collectionsToRender = JSON.parse(readFileSync(resourceConfigurationUrl, 'utf8'));
    for (const collection of collectionsToRender) {
        const path = resourcePath(collection.uid);
        const metadataUrl = `${collectoryServicesUrl}/${path}/${collection.uid}`;
        try {
            const collectionMetadata = await fetch(metadataUrl).then(res => res.json());
            resources.push({
                uid: collectionMetadata.uid,
                name: collectionMetadata.name,
                institution: { name: collectionMetadata.institution?.name},
                displayCollectionImage: collection.imageUrl,
                pubDescription: collectionMetadata.pubDescription
            });
        } catch (ex) {
            console.error(`Unable to access while building collections ${metadataUrl}`, ex);
        }
    }

    // write the resources to a file
    writeFileSync(resourcesFile, JSON.stringify(resources, null, 2));
};

buildResources();
