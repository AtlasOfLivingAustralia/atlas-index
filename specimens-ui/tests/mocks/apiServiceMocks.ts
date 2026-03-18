import {Page} from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from "url";

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPageSize = Number(process.env.VITE_PAGE_SIZE ?? 100);

// Load mock data files
const g_collectionsPath = path.resolve(__dirname, '../resources/collections.json');
const g_collections = JSON.parse(fs.readFileSync(g_collectionsPath, 'utf-8'));

const g_occurrencesWithImagesPath = path.resolve(__dirname, '../resources/occurrences-with-images.json');
const g_occurrencesWithImages = JSON.parse(fs.readFileSync(g_occurrencesWithImagesPath, 'utf-8'));

const g_phylumFacetPath = path.resolve(__dirname, '../resources/phylum-facet.json');
const g_phylumFacet = JSON.parse(fs.readFileSync(g_phylumFacetPath, 'utf-8'));

const g_collectionCo56Path = path.resolve(__dirname, '../resources/collection-co56.json');
const g_collectionCo56 = JSON.parse(fs.readFileSync(g_collectionCo56Path, 'utf-8'));

const g_collectionCo56OrdersPath = path.resolve(__dirname, '../resources/collection-co56-orders.json');
const g_collectionCo56Orders = JSON.parse(fs.readFileSync(g_collectionCo56OrdersPath, 'utf-8'));

const g_collectionCo56HolotypesPath = path.resolve(__dirname, '../resources/collection-co56-holotypes.json');
const g_collectionCo56Holotypes = JSON.parse(fs.readFileSync(g_collectionCo56HolotypesPath, 'utf-8'));

const g_collectionCo56ClassPath = path.resolve(__dirname, '../resources/collection-co56-class.json');
const g_collectionCo56Class = JSON.parse(fs.readFileSync(g_collectionCo56ClassPath, 'utf-8'));

const g_collectionCo56PhylumPath = path.resolve(__dirname, '../resources/collection-co56-phylum.json');
const g_collectionCo56Phylum = JSON.parse(fs.readFileSync(g_collectionCo56PhylumPath, 'utf-8'));

const g_collectionCo56FamiliesPath = path.resolve(__dirname, '../resources/collection-co56-families.json');
const g_collectionCo56Families = JSON.parse(fs.readFileSync(g_collectionCo56FamiliesPath, 'utf-8'));

export async function apiMocks(page: Page, seenUrls: Set<URL>) {
    /**
     * Mock biocache-ws occurrences/search endpoint
     * This is the main API endpoint for specimen searches
     */
    await page.route('**/biocache-ws*.ala.org.au/ws/occurrences/search**',
        async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);

            const facets = url.searchParams.get('facets');
            const fqs = url.searchParams.getAll('fq');
            const startParam = url.searchParams.get('start');
            const start = startParam ? parseInt(startParam, 10) : 0;
            const requestPageSizeParam = url.searchParams.get('pageSize');
            const requestPageSize = requestPageSizeParam
                ? parseInt(requestPageSizeParam, 10)
                : defaultPageSize;

            // Determine which collection is being queried
            const collectionUidFilter = fqs.find(f => f.startsWith('collectionUid:'));
            const isCollectionCo56 = collectionUidFilter?.includes('co56');

            // Determine taxonomy filters
            const hasKingdom = fqs.some(f => f.startsWith('kingdom:'));
            const hasPhylum = fqs.some(f => f.startsWith('phylum:'));
            const hasClass = fqs.some(f => f.startsWith('class:'));
            const hasOrder = fqs.some(f => f.startsWith('order:'));

            // Determine other filters
            const hasTypeStatus = fqs.some(f => f.startsWith('typeStatus:'));
            const isHolotype = fqs.some(f => f.includes('HOLOTYPE'));

            var response;

            // Collection co56 with holotype filter
            if (isCollectionCo56 && isHolotype) {
                response = JSON.parse(JSON.stringify(g_collectionCo56Holotypes));
                response.startIndex = start;
            }
            // Collection co56 with all 4 ranks set (Kingdom, Phylum, Class, Order) - show families
            else if (isCollectionCo56 && hasKingdom && hasPhylum && hasClass && hasOrder && fqs.some(f => f.includes('order:"Coleoptera"')) && facets?.includes('family')) {
                response = JSON.parse(JSON.stringify(g_collectionCo56Families));
                response.startIndex = start;
            }
            // Collection co56 with all 3 ranks set (Kingdom, Phylum, Class) - show orders
            else if (isCollectionCo56 && hasKingdom && hasPhylum && hasClass && facets?.includes('order')) {
                response = JSON.parse(JSON.stringify(g_collectionCo56Orders));
                response.startIndex = start;
            }
            // Collection co56 with Kingdom and Phylum set - return single Class for auto-drill
            else if (isCollectionCo56 && hasKingdom && hasPhylum && facets?.includes('class')) {
                response = JSON.parse(JSON.stringify(g_collectionCo56Class));
                response.startIndex = start;
            }
            // Collection co56 with only Kingdom set - return single Phylum for auto-drill
            else if (isCollectionCo56 && hasKingdom && facets?.includes('phylum')) {
                response = JSON.parse(JSON.stringify(g_collectionCo56Phylum));
                response.startIndex = start;
            }
            // Collection co56 initial view (show single kingdom facet for auto-drill)
            else if (isCollectionCo56 && facets?.includes('kingdom')) {
                response = JSON.parse(JSON.stringify(g_collectionCo56));
                response.startIndex = start;
            }
            // Animalia kingdom selected (show phylum facet)
            else if (hasKingdom && facets?.includes('phylum')) {
                response = JSON.parse(JSON.stringify(g_phylumFacet));
                response.startIndex = start;
            }
            // All collections default view (show kingdom facet)
            else {
                response = JSON.parse(JSON.stringify(g_occurrencesWithImages));
                response.startIndex = start;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        }
    );

    /**
     * Mock collections.json endpoint - used by home page to show collection thumbnails
     */
    await page.route('**/collections.json', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(g_collections)
        });
    });
}

/**
 * Generate more occurrences for pagination testing by duplicating existing occurrences
 * with sequential IDs appended to simulate pagination
 */
function generateMoreOccurrences(start: number, pageSize: number, collection: string): any[] {
    // Get the base occurrences from the appropriate collection
    let baseOccurrences;
    if (collection === 'co56') {
        baseOccurrences = g_collectionCo56.occurrences;
    } else {
        baseOccurrences = g_occurrencesWithImages.occurrences;
    }

    if (!baseOccurrences || baseOccurrences.length === 0) {
        return [];
    }

    const occurrences = [];
    for (let i = 0; i < pageSize; i++) {
        const idx = start + i;
        // Cycle through base occurrences
        const baseOccurrence = baseOccurrences[idx % baseOccurrences.length];

        // Clone the occurrence and append sequence number to ID fields
        const clonedOccurrence = JSON.parse(JSON.stringify(baseOccurrence));

        // Append sequence number to uuid and other ID fields
        if (clonedOccurrence.uuid) {
            clonedOccurrence.uuid = `${clonedOccurrence.uuid}-${idx}`;
        }
        if (clonedOccurrence.id) {
            clonedOccurrence.id = `${clonedOccurrence.id}-${idx}`;
        }

        // Update image IDs if present
        if (clonedOccurrence.imageMetadata && Array.isArray(clonedOccurrence.imageMetadata)) {
            clonedOccurrence.imageMetadata = clonedOccurrence.imageMetadata.map((img: any) => ({
                ...img,
                imageId: img.imageId ? `${img.imageId}-${idx}` : `img-${idx}`,
                thumbUrl: img.thumbUrl ? img.thumbUrl.replace(/imageId=[^&]*/, `imageId=${img.imageId}-${idx}`) : undefined
            }));
        }

        occurrences.push(clonedOccurrence);
    }

    return occurrences;
}
