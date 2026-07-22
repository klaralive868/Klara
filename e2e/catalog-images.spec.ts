import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	IMAGES_OWNER_EMAIL,
	IMAGES_OWNER_PASSWORD,
	SECOND_ORG_EMAIL,
	SECOND_ORG_PASSWORD
} from './test-user';

const IMAGE_1 = path.join(import.meta.dirname, 'fixtures', 'test-image-1.png');
const IMAGE_2 = path.join(import.meta.dirname, 'fixtures', 'test-image-2.png');

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
	// Same click-retry pattern as the other catalog specs — an occasional
	// layout-shift-timed click miss, not a reactivity bug.
	await expect(async () => {
		await button.click();
		await expect(hiddenInput).toHaveValue(key, { timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

async function createItem(page: Page, name: string) {
	await page.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Price (USD)').fill('40.00');
	await selectMaterialType(page, 'Jersey', 'jersey');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');
	await page.getByRole('link', { name }).click();
	await page.waitForLoadState('networkidle');
}

test('upload multiple images, first auto-primary, re-mark primary, remove an image', async ({
	page
}) => {
	await signIn(page, IMAGES_OWNER_EMAIL, IMAGES_OWNER_PASSWORD);

	const itemName = uniqueName('E2E Image Item');
	await createItem(page, itemName);

	// No images yet — no primary/remove controls, just the upload form.
	await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);

	await page.setInputFiles('input[type="file"][name="images"]', [IMAGE_1, IMAGE_2]);
	await page.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Images uploaded.');

	// Two images now, and the first upload is auto-marked primary — exactly
	// one "Primary" label and exactly one "Set primary" button.
	await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(2);
	await expect(page.getByText('Primary', { exact: true })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Set primary' })).toHaveCount(1);

	// Re-mark the other image primary.
	await page.getByRole('button', { name: 'Set primary' }).click();
	await expect(page.getByRole('status')).toHaveText('Primary image updated.');
	await expect(page.getByText('Primary', { exact: true })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Set primary' })).toHaveCount(1);

	// Remove one image — one remains, still exactly one primary.
	await page.getByRole('button', { name: 'Remove' }).first().click();
	await expect(page.getByRole('status')).toHaveText('Image removed.');
	await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(1);
	await expect(page.getByText('Primary', { exact: true })).toHaveCount(1);

	// Reload from the server and confirm the remaining image persisted.
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(1);
	await expect(page.getByText('Primary', { exact: true })).toHaveCount(1);
});

test("a different organization's member cannot see or manage this organization's item images", async ({
	page,
	browser
}) => {
	await signIn(page, IMAGES_OWNER_EMAIL, IMAGES_OWNER_PASSWORD);

	const itemName = uniqueName('E2E Denied Image Item');
	await createItem(page, itemName);

	await page.setInputFiles('input[type="file"][name="images"]', [IMAGE_1]);
	await page.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Images uploaded.');

	const editUrl = page.url();

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0008_catalog_item_images_rls.sql: visiting the
	// item's edit URL directly 404s (RLS hides the item itself), so the
	// image controls are never reachable from another organization.
	await secondOrgPage.goto(editUrl);
	await expect(secondOrgPage.getByText('Item not found')).toBeVisible();

	await secondOrgContext.close();
});
