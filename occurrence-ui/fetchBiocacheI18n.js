// fetch biocache-service i18n and integrate into ./src/translations/{language}.json
import https from 'https';
import fs from 'fs';
import path from 'path';

// Configuration
const language = 'en';
const i18nUrl = 'https://biocache.ala.org.au/ws/facets/i18n';

const outputDir = path.join('./', 'src', 'translations');
const outputFilePath = path.join(outputDir, language + '.json');
const localPropertiesPath = path.join('./', 'messages_' + language + '.properties');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Used for importing existing messages_{language}.properties that was source from biocache-hubs and is in the same directory
async function importProperties() {
    // Load local properties and append to {language}.json
    try {
        console.log('Importing ' + localPropertiesPath + ' properties...');
        const data = fs.readFileSync(localPropertiesPath, 'utf8');
        await mergeProperties(data);
    } catch (err) {
        console.error('Error processing local properties:', err);
    }
}

// Fetch remote i18n and append to {language}.json
async function readJson() {
    console.log('Importing ' + i18nUrl + ' properties...');
    const response = await fetch(i18nUrl);

    // Check if the request was successful
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    let text = await response.text();
    await mergeProperties(text);
}

async function mergeProperties(data) {
    const lines = data.split('\n');
    const i18nObj = {};

    lines.forEach(line => {
        if (!line.trim() || line.startsWith('#')) return;
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            i18nObj[key.trim()] = value;
        }
    });

    const existingTranslations = JSON.parse(await fs.promises.readFile(outputFilePath, 'utf8'));
    const mergedTranslations = {...existingTranslations, ...i18nObj};
    fs.writeFileSync(outputFilePath, JSON.stringify(mergedTranslations, null, 2), 'utf8');
    console.log('existing (' + Object.keys(existingTranslations).length + ')' +
        ' merged with new (' + Object.keys(i18nObj).length + ') and written to ' +
        outputFilePath + ' (' + Object.keys(mergedTranslations).length + ')');
}

// Remove duplicate keys under legacy names
async function cleanup() {
    const translations = JSON.parse(await fs.promises.readFile(outputFilePath, 'utf8'));

    let removed = 0;

    // remove all that begin with "field.". They are el/cl fields and duplicated by the labels "facet."
    for (const key in translations) {
        if (key.startsWith('field.')) {
            delete translations[key];
            removed++;
        }
    }

    // find all basisOfRecord.{bor}={value} and remove the any {bor}={value}, except when bor == "unknown" (case insensitive)
    const borKeys = {};
    for (const key in translations) {
        if (key.startsWith('basisOfRecord.')) {
            const bor = key.substring('basisOfRecord.'.length);
            if (bor.toLowerCase() !== 'unknown') {
                borKeys[bor] = translations[key];
            }
        }
    }
    for (const bor in borKeys) {
        if (translations.hasOwnProperty(bor)) {
            delete translations[bor];
            removed++;
        }
    }

    // find all assertions.{assertion}={value} and remove the any {assertion}={value}
    const assertionKeys = {};
    for (const key in translations) {
        if (key.startsWith('assertions.')) {
            const assertion = key.substring('assertions.'.length);
            assertionKeys[assertion] = translations[key];
        }
    }
    for (const assertion in assertionKeys) {
        if (translations.hasOwnProperty(assertion)) {
            delete translations[assertion];
            removed++;
        }
    }

    // remove all 'dwc.' keys as they are duplicates of 'facet.dwc.' keys
    for (const key in translations) {
        if (key.startsWith('dwc.')) {
            delete translations[key];
            removed++;
        }
    }

    // remove all '*.novalue' whose value differs from the value of `default.novalue'
    const defaultNovalue = translations['default.novalue'];
    for (const key in translations) {
        if (key.endsWith('.novalue')) {
            if (translations[key] !== defaultNovalue) {
                delete translations[key];
                removed++;
            }
        }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(translations, null, 2), 'utf8');
    console.log('Cleanup completed. Removed ' + removed + ' duplicate/legacy keys from ' + outputFilePath);
}

// Uncomment the following line to import local properties file
await importProperties();

// always fetch remote i18n
await readJson();

// remove duplicate keys under legacy names
await cleanup();

