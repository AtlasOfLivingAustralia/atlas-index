import {Page} from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from "url";
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const g_regionsListPath = path.resolve(__dirname, '../resources/regionsList.json');
const g_regionsList = JSON.parse(fs.readFileSync(g_regionsListPath, 'utf-8'));
const g_kingdomsPath = path.resolve(__dirname, '../resources/kingdoms.json');
const g_kingdoms = JSON.parse(fs.readFileSync(g_kingdomsPath, 'utf-8'));
const g_speciesPath = path.resolve(__dirname, '../resources/species.json');
const g_species = JSON.parse(fs.readFileSync(g_speciesPath, 'utf-8'));
const g_speciesGroupsPath = path.resolve(
    __dirname,
    '../resources/speciesGroups.json'
);
const g_speciesGroups = JSON.parse(
    fs.readFileSync(g_speciesGroupsPath, 'utf-8')
);


export async function apiMocks(page: Page, seenUrls: Set<URL> ) {
    await page.route(
        '**/biocache-ws*.ala.org.au/ws/occurrences/search**',
        async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);

            const facets = url.searchParams.get('facets');
            const fqs = url.searchParams.getAll('fq');
            const hasOccurrenceYear = fqs.some(f => f.startsWith('occurrenceYear:'));

            var response;
            if (facets === 'species') {
                // Adjust the species facet counts if occurrenceYear has been set to start from 2024
                if (hasOccurrenceYear) {
                    const occurrenceYearFilter = fqs.find(f => f.startsWith('occurrenceYear:'));
                    const range = occurrenceYearFilter?.split(':')[1]?.replace(/^\[|\]$/g, ''); // removes brackets
                    const startDate = range?.split(' TO ')[0];
                    const startsFrom2024 = startDate?.startsWith('2024-01-01');
                    if (startsFrom2024) {
                        const fieldResults = g_species['facetResults'][0]['fieldResult'];
                        var adjustedResults = fieldResults.map(item => ({
                            ...item,
                            count: item.count > 0 ? item.count - 1 : item.count,
                        }));
                        g_species['facetResults'][0]['fieldResult'] = adjustedResults;
                    }
                }

                response = g_species;
            } else if (facets === 'kingdom') {
                response = g_kingdoms;
            } else if (facets === 'speciesGroup') {
                response = g_speciesGroups;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        }
    );

    await page.route('**/regionsList.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(g_regionsList)
        });
    });

    await page.route('**/spatial*.ala.org.au/ws/object/*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        // always return the same response, a successful intersection
        const response = {
            pid: '8832857',
            name: 'AUSTRALIAN CAPITAL TERRITORY',
            wmsurl: 'https://spatial.ala.org.au/geoserver/wms?service=WMS&version=1.1.0&request=GetMap&layers=ALA:Objects&format=image/png&viewparams=s:8832857',
            fid: 'cl10925',
            fieldname: 'PSMA States (2016)',
            bbox: 'POLYGON((148.762675104 -35.9207620485,148.762675104 -35.124517035,149.399284512 -35.124517035,149.399284512 -35.9207620485,148.762675104 -35.9207620485))',
            description: 'AUSTRALIAN CAPITAL TERRITORY',
            area_km: 2363.2136863251985,
            id: '8832857',
        };
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });

    await page.route(
        '**/spatial*.ala.org.au/ws/intersect/cl10925/*/*',
        async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);

            // always return the same response, a successful intersection
            const response = [
                {
                    field: 'cl10925',
                    description: 'AUSTRALIAN CAPITAL TERRITORY',
                    layername: 'PSMA States (2016)',
                    pid: '8832857',
                    value: 'AUSTRALIAN CAPITAL TERRITORY',
                },
            ];
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        }
    );

}