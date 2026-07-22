import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	CATEGORIES_OWNER_EMAIL,
	CATEGORIES_OWNER_PASSWORD,
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

function uniqueName(label: string) {
	return `${label} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function selectMaterialType(page: Page, label: string, key: string) {
	const button = page.getByRole('button', { name: label });
	const hiddenInput = page.locator('input[name="materialType"]');
	// Same click-retry pattern as catalog-item-crud.spec.ts — an occasional
	// layout-shift-timed click miss, not a reactivity bug.
	await expect(async () => {
		await button.click();
		await expect(hiddenInput).toHaveValue(key, { timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

async function checkCategory(page: Page, label: string) {
	const checkbox = page.getByLabel(label);
	// Same occasional layout-shift-timed click miss as selectMaterialType —
	// retry the whole check, not just the read.
	await expect(async () => {
		await checkbox.check();
		await expect(checkbox).toBeChecked({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

async function uncheckCategory(page: Page, label: string) {
	const checkbox = page.getByLabel(label);
	await expect(async () => {
		await checkbox.uncheck();
		await expect(checkbox).not.toBeChecked({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

test('create top-level + subcategory, tag an item with both at once, and gate/allow publish', async ({
	page
}) => {
	await signIn(page, CATEGORIES_OWNER_EMAIL, CATEGORIES_OWNER_PASSWORD);

	const topLevelName = uniqueName('Male');
	const subcategoryName = uniqueName('Shoes');

	await page.goto('/dashboard/catalog/categories', { waitUntil: 'networkidle' });
	await page.getByLabel('New top-level category name').fill(topLevelName);
	await page.getByRole('button', { name: 'Add category' }).click();
	await page.waitForLoadState('networkidle');

	const topLevelRow = page.locator(
		`[data-testid="category-row"][data-category-name="${topLevelName}"]`
	);
	await expect(topLevelRow).toBeVisible();

	await topLevelRow.getByLabel(`New subcategory name for ${topLevelName}`).fill(subcategoryName);
	await topLevelRow.getByRole('button', { name: 'Add subcategory' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.locator(`[data-category-name="${subcategoryName}"]`)).toBeVisible();

	// Create an item with zero categories tagged — publish must be blocked.
	const itemName = uniqueName('E2E Publish Gating Item');
	await page.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(itemName);
	await page.getByLabel('Price (USD)').fill('30.00');
	await selectMaterialType(page, 'Jersey', 'jersey');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');

	await page.getByRole('link', { name: itemName }).click();
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('alert')).toHaveText('Add at least one category before publishing.');
	await expect(page.getByText('Status: draft')).toBeVisible();

	// Tag it with both the top-level category AND the subcategory at once,
	// save, then verify both persisted. Retried as one unit — under load, an
	// occasional layout-shift-timed click can leave the DOM checkbox state
	// not matching what actually got submitted; re-running the whole
	// check+save+verify cycle is safe since it's idempotent.
	await expect(async () => {
		await checkCategory(page, topLevelName);
		await checkCategory(page, subcategoryName);
		await page.getByRole('button', { name: 'Save item' }).click();
		await expect(page.getByRole('status')).toHaveText('Item saved.', { timeout: 5000 });
		await expect(page.getByLabel(topLevelName)).toBeChecked({ timeout: 1000 });
		await expect(page.getByLabel(subcategoryName)).toBeChecked({ timeout: 1000 });
	}).toPass({ timeout: 30_000 });

	// Regression check: uncheck both tags (without saving) and click Publish
	// directly. It must be blocked, AND the item's already-saved tags must
	// survive untouched — an earlier version synced (deleting the old tags)
	// before checking the count, wiping them even on the blocked path.
	await expect(async () => {
		await uncheckCategory(page, topLevelName);
		await uncheckCategory(page, subcategoryName);
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toHaveText(
			'Add at least one category before publishing.',
			{ timeout: 5000 }
		);
	}).toPass({ timeout: 30_000 });
	await expect(page.getByText('Status: draft')).toBeVisible();
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByLabel(topLevelName)).toBeChecked();
	await expect(page.getByLabel(subcategoryName)).toBeChecked();

	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('status')).toHaveText('Item published.');
	await expect(page.getByText('Status: published')).toBeVisible();

	// Reload from the server and confirm both tags persisted, not just the
	// in-memory form state.
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByLabel(topLevelName)).toBeChecked();
	await expect(page.getByLabel(subcategoryName)).toBeChecked();
});

test("a different organization's member cannot see or tag with this organization's categories", async ({
	page,
	browser
}) => {
	await signIn(page, CATEGORIES_OWNER_EMAIL, CATEGORIES_OWNER_PASSWORD);

	const categoryName = uniqueName('Denied Org Category');
	await page.goto('/dashboard/catalog/categories', { waitUntil: 'networkidle' });
	await page.getByLabel('New top-level category name').fill(categoryName);
	await page.getByRole('button', { name: 'Add category' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.locator(`[data-category-name="${categoryName}"]`)).toBeVisible();

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0006_catalog_categories_rls.sql: the other org's
	// categories screen never shows this category, and it doesn't appear as
	// a taggable option on the item form either.
	await secondOrgPage.goto('/dashboard/catalog/categories', { waitUntil: 'networkidle' });
	await expect(secondOrgPage.locator(`[data-category-name="${categoryName}"]`)).toHaveCount(0);

	await secondOrgPage.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await expect(secondOrgPage.getByLabel(categoryName)).toHaveCount(0);

	await secondOrgContext.close();
});
