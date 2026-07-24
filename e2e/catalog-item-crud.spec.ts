import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	CATALOG_OWNER_EMAIL,
	CATALOG_OWNER_PASSWORD,
	SECOND_ORG_EMAIL,
	SECOND_ORG_PASSWORD
} from './test-user';

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
}

async function selectMaterialType(page: Page, label: string, key: string) {
	const button = page.getByRole('button', { name: label });
	const hiddenInput = page.locator('input[name="materialType"]');
	// Occasionally misses (a layout shift right as the click lands, from the
	// fields filled immediately before this), which reads as the click never
	// having registered at all — not just a delayed update, since a bare
	// retrying assertion on its own still timed out. Retrying the click itself
	// (not just the read) is the robust fix; a real user re-clicking would
	// recover the same way.
	await expect(async () => {
		await button.click();
		await expect(hiddenInput).toHaveValue(key, { timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

function uniqueItemName(label: string) {
	return `${label} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test('create an item end-to-end, then edit it', async ({ page }) => {
	await signIn(page, CATALOG_OWNER_EMAIL, CATALOG_OWNER_PASSWORD);

	const itemName = uniqueItemName('E2E Jersey');

	await page.goto('/dashboard/catalog/new');
	await page.getByLabel('Name').fill(itemName);
	await page.getByLabel('Description').fill('A jersey created by an e2e test.');
	await page.getByLabel('Price (USD)').fill('49.99');
	await selectMaterialType(page, 'Jersey', 'jersey');
	await page.getByRole('button', { name: 'Save item' }).click();

	await expect(page).toHaveURL('/dashboard/catalog');
	const row = page.getByRole('row').filter({ hasText: itemName });
	await expect(row).toBeVisible();
	await expect(row).toContainText('Jersey');
	await expect(row).toContainText('$49.99');
	await expect(row).toContainText('draft');

	await row.getByRole('link', { name: itemName }).click();
	await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible();
	await expect(page.getByLabel('Name')).toHaveValue(itemName);
	await expect(page.getByLabel('Price (USD)')).toHaveValue('49.99');

	const editedName = `${itemName} (edited)`;
	await page.getByLabel('Name').fill(editedName);
	await page.getByLabel('Price (USD)').fill('55.00');
	await page.getByRole('button', { name: 'Save item' }).click();

	await expect(page.getByRole('status')).toHaveText('Item saved.');
	await expect(page.getByLabel('Name')).toHaveValue(editedName);
	await expect(page.getByLabel('Price (USD)')).toHaveValue('55.00');

	await page.goto('/dashboard/catalog');
	await expect(page.getByRole('row').filter({ hasText: editedName })).toBeVisible();
});

test('archive then unarchive an item', async ({ page }) => {
	await signIn(page, CATALOG_OWNER_EMAIL, CATALOG_OWNER_PASSWORD);

	const itemName = uniqueItemName('E2E Archivable');

	await page.goto('/dashboard/catalog/new');
	await page.getByLabel('Name').fill(itemName);
	await page.getByLabel('Price (USD)').fill('10.00');
	await selectMaterialType(page, 'Shorts', 'shorts');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');

	await page.getByRole('link', { name: itemName }).click();
	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByRole('status')).toHaveText('Item archived.');
	await expect(page.getByText('Status: archived')).toBeVisible();

	await page.getByRole('button', { name: 'Unarchive' }).click();
	await expect(page.getByRole('status')).toHaveText('Item restored to draft.');
	await expect(page.getByText('Status: draft')).toBeVisible();

	await page.goto('/dashboard/catalog');
	await expect(
		page.getByRole('row').filter({ hasText: itemName }).getByText('draft')
	).toBeVisible();
});

test("the item list only shows the caller's own organization's items, and a foreign item id 404s", async ({
	page,
	browser
}) => {
	await signIn(page, CATALOG_OWNER_EMAIL, CATALOG_OWNER_PASSWORD);

	const ownItemName = uniqueItemName('E2E Own Org Item');
	await page.goto('/dashboard/catalog/new');
	await page.getByLabel('Name').fill(ownItemName);
	await page.getByLabel('Price (USD)').fill('20.00');
	await selectMaterialType(page, 'Jeans', 'jeans');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');

	const ownItemHref = await page.getByRole('link', { name: ownItemName }).getAttribute('href');
	if (!ownItemHref) throw new Error('e2e setup failure: could not resolve the created item URL');

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Cross-organization denied-access, exercised through the actual UI/session
	// (mirroring supabase/tests/0005_catalog_items_rls.sql): the other org's
	// list never shows this item, and visiting its edit URL directly 404s.
	await secondOrgPage.goto('/dashboard/catalog');
	await expect(secondOrgPage.getByRole('row').filter({ hasText: ownItemName })).toHaveCount(0);

	await secondOrgPage.goto(ownItemHref);
	await expect(secondOrgPage.getByText('Item not found')).toBeVisible();

	await secondOrgContext.close();
});
