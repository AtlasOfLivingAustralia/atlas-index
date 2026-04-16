import {Page} from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from "url";
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function apiMocks(page: Page, seenUrls: Set<URL> ) {
     // TODO: add a mock and test for the classification hierarchy component
}
