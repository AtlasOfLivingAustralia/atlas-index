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
const g_occurrencesPath = path.resolve(__dirname, '../resources/occurrences.json');
const g_occurrences = JSON.parse(fs.readFileSync(g_occurrencesPath, 'utf-8'));

/**
 * Mock the /session endpoint so App.tsx's checkLoginState resolves cleanly
 * without a network connection.  Returns an anonymous (not authenticated)
 * session by default — regions-ui does not require login, so this is correct
 * for all test scenarios.
 *
 * Must be registered AFTER logMissingMocks so that Playwright's
 * reverse-registration priority gives this mock higher priority than the
 * catch-all throw route.
 */
export async function mockSession(page: Page, seenUrls: Set<URL>) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false }),
        })
    );
}

export async function apiMocks(page: Page, seenUrls: Set<URL> ) {
    /**
     * NOTES: check if conditions carefully, requests may be intercepted
     */
    await page.route('**/biocache-ws*.ala.org.au/ws/occurrences/search**',
        async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);

            const facets = url.searchParams.get('facets');
            const fqs = url.searchParams.getAll('fq');
            // Return occurrences when no facets in query
            const searchOccurrences = fqs.some(f => f.startsWith('species:'));
            // Only update the record number when query facade
            const hasOccurrenceYear = fqs.some(f => f.startsWith('occurrenceYear:'));

            var response;
            if (facets === 'species,decade') {
                // Adjust the species facet counts if occurrenceYear has been set to 2024 or after
                if (hasOccurrenceYear) {
                    const occurrenceYearFilter = fqs.find(f => f.startsWith('occurrenceYear:'));
                    const range = occurrenceYearFilter?.split(':')[1]?.replace(/^\[|\]$/g, ''); // removes brackets
                    const startDate = range?.split(' TO ')[0];
                    const year = parseInt(startDate?.substring(0, 4) ?? '', 10);
                    //Simulate record changes for year 2024 and onwards
                    const isAfter2024 = year >= 2024;
                    if (isAfter2024) {
                        const fieldResults = g_species['facetResults'][0]['fieldResult'];
                        var adjustedResults = fieldResults.map((item: any) => ({
                            ...item,
                            count: item.count > 0 ? item.count - 1 : item.count,
                        }));
                        g_species['facetResults'][0]['fieldResult'] = adjustedResults;
                    }
                }
                response = g_species;
            } else if (facets === 'kingdom,decade') {
                response = g_kingdoms;
            } else if (facets === 'speciesGroup,decade') {
                response = g_speciesGroups;
            } else if (searchOccurrences) {
                response = g_occurrences;
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

    //BIE species search mockup
    await page.route(/https?:\/\/bie\..*\/species\/.*/, async route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        // Extract the part after "/species/"
        const match = url.pathname.match(/\/species\/([^/]+)/);
        const uuid = match ? match[1] : 'unknown-uuid';

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                "guid": uuid,
                "name": "Aaaaba fossicollis (Kerremans, 1903)",
                "country": "Australia",
                "kingdom": "Animalia",
                "phylum": "Arthropoda",
                "classs": "Insecta",
                "order": "Coleoptera",
                "family": "Buprestidae",
                "genus": "Aaaaba",
                "occurrenceCount": 62
            }),
        });
    });

    // Mock the session endpoint — must be registered last so it wins over the
    // logMissingMocks catch-all (Playwright resolves routes last-registered first).
    await mockSession(page, seenUrls);
}
