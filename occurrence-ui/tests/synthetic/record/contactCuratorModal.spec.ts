import { test, expect } from '../../fixtures';
import { setupMocks, loadRecord, g_collectionContacts } from '../helpers';
import { setupRecordMocks, mockCollectionContacts, g_acaciaRecord } from '../../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/list/contactCuratorModal.tsx (87 lines --
// lives under components/list/, not components/occurrence/, despite only ever
// being used from the record-detail page), 0% coverage per
// PLAYWRIGHT_TEST.md §5.3.3. No login gate at all (independent of
// userInfo?.authenticated) -- gated purely on recordSidebar.tsx's own
// `contacts && contacts.length > 0` check around the #showCurator trigger.
// ===========================================================================

test.describe('ContactCuratorModal', () => {
    test('the trigger does not render at all under the plain default mock setup (documents why this is 0%-covered today)', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        // setupRecordMocks()'s generic mockCollectory() answers EVERY collectory path
        // (including the collection-contacts one) with a bare {} -- contacts.length is
        // therefore undefined, so recordSidebar.tsx's `contacts && contacts.length > 0`
        // is falsy and #showCurator never renders.
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('#showCurator')).toHaveCount(0);
    });

    test('with real contacts, the trigger opens a modal listing both contacts with a primary-contact marker on only the first', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls);
        // Must be registered AFTER setupRecordMocks()/mockCollectory() so it takes
        // priority (Playwright resolves routes in reverse-registration order).
        await mockCollectionContacts(page, seenUrls, g_collectionContacts);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        const trigger = page.locator('#showCurator');
        await expect(trigger).toBeVisible();
        await trigger.click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Contact curator');

        const janeAddress = modal.locator('address', { hasText: 'Jane Curator' });
        await expect(janeAddress).toContainText('Collection Manager');
        await expect(janeAddress).toContainText('02 6246 5000');
        await expect(janeAddress.getByText('email this contact')).toBeVisible();
        await expect(janeAddress.locator('.primaryContact')).toHaveCount(1);

        const samAddress = modal.locator('address', { hasText: 'Sam Botanist' });
        // The raw email address itself is NEVER rendered as visible text anywhere --
        // emailLink()'s children is always just the "email this contact" message;
        // the address is only used internally to build the mailto: href.
        await expect(samAddress.getByText('email this contact')).toBeVisible();
        // Sam is not the primary contact -- no marker on his entry.
        await expect(samAddress.locator('.primaryContact')).toHaveCount(0);

        // The static legend footer (distinct from any per-contact marker) always renders.
        await expect(modal).toContainText('Primary Contact');

        // getByRole('button', {name:'Close'}) is ambiguous here too (Modal.Header's
        // closeButton X-icon shares the same accessible name as the footer's own
        // text button) -- scope to the footer, which has exactly one button.
        const urlBefore = page.url();
        await modal.locator('.modal-footer button').click();
        await expect(modal).not.toBeVisible();
        expect(page.url()).toBe(urlBefore);
    });

    test('a contact with no email set renders no "email this contact" link for that entry, but still shows name/role', async ({ page }) => {
        const noEmailContacts = [
            { contact: { firstName: 'Pat', lastName: 'NoEmail', phone: '02 1111 2222' }, primaryContact: false, role: 'Volunteer' },
        ];
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls);
        await mockCollectionContacts(page, seenUrls, noEmailContacts);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#showCurator').click();
        const modal = page.getByRole('dialog');
        const patAddress = modal.locator('address', { hasText: 'Pat NoEmail' });
        await expect(patAddress).toBeVisible();
        await expect(patAddress).toContainText('Volunteer');
        await expect(patAddress).toContainText('02 1111 2222');
        await expect(patAddress.getByText('email this contact')).toHaveCount(0);
    });

    // Deliberately no test clicks "email this contact": sendEmail() does a real
    // `window.location.href = 'mailto:...'` assignment, which Chromium/Firefox/WebKit
    // hand off to the OS's registered mail client *outside* the page/network stack --
    // confirmed this is not interceptable via Playwright route()/addInitScript() (both
    // `window.location` and `Location.prototype`'s `href` accessor are non-configurable),
    // so clicking it in a real (non-headless) or WebKit run launches the actual system
    // mail app. The two tests above already assert the link renders (or doesn't, when no
    // email is set) via visibility checks alone, which is enough for this codebase's
    // established "light touch" precedent around mailto: links (see also
    // dataQualityModals.spec.ts, which only asserts the `a[href^="mailto:"]` attribute).
});
