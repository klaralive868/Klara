import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	STOCK_OWNER_EMAIL,
	STOCK_OWNER_PASSWORD,
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
	// Same click-retry pattern as the other catalog specs — an occasional
	// layout-shift-timed click miss, not a reactivity bug.
	await expect(async () => {
		await button.click();
		await expect(hiddenInput).toHaveValue(key, { timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

function stockInput(page: Page, size: string) {
	// getByText's exact match normalizes/trims whitespace — a plain
	// :has-text("S") would ambiguously substring-match "XS" too, and a raw
	// ^...$ regex against unnormalized textContent misses the whitespace
	// the template renders around the label text.
	return page.getByText(size, { exact: true }).locator('input[type="number"]');
}

test('set stock on create, edit quantities, and persist across reload', async ({ page }) => {
	await signIn(page, STOCK_OWNER_EMAIL, STOCK_OWNER_PASSWORD);

	const itemName = uniqueName('E2E Stock Item');
	await page.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(itemName);
	await page.getByLabel('Price (USD)').fill('45.00');
	await selectMaterialType(page, 'Jersey', 'jersey');

	await stockInput(page, 'M').fill('12');
	await stockInput(page, 'L').fill('8');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');

	await page.getByRole('link', { name: itemName }).click();
	await page.waitForLoadState('networkidle');
	await expect(stockInput(page, 'M')).toHaveValue('12');
	await expect(stockInput(page, 'L')).toHaveValue('8');
	await expect(stockInput(page, 'S')).toHaveValue('0');

	// Edit quantities.
	await stockInput(page, 'M').fill('20');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page.getByRole('status')).toHaveText('Item saved.');

	// Reload from the server and confirm the edit persisted (not duplicated
	// into a second row — a duplicate would surface as a distinct bug, e.g.
	// the input showing something other than a single clean value).
	await page.reload({ waitUntil: 'networkidle' });
	await expect(stockInput(page, 'M')).toHaveValue('20');
	await expect(stockInput(page, 'L')).toHaveValue('8');

	// Switch Material Type to a different sizing scheme (gendered) — the old
	// scheme's stock rows must be reconciled away, not linger.
	await selectMaterialType(page, 'Shoes', 'shoes');
	await expect(page.getByText('Male sizes', { exact: true })).toBeVisible();
	await stockInput(page, '12').fill('5');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page.getByRole('status')).toHaveText('Item saved.');

	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByText('Male sizes', { exact: true })).toBeVisible();
	await expect(stockInput(page, '12')).toHaveValue('5');
	await expect(stockInput(page, '5')).toHaveValue('0');

	// Switching back to the standardTops scheme must not resurrect the
	// jersey-era M/L quantities — those rows were reconciled away above.
	await selectMaterialType(page, 'Jersey', 'jersey');
	await expect(stockInput(page, 'M')).toHaveValue('0');
	await expect(stockInput(page, 'L')).toHaveValue('0');
});

test("a different organization's member cannot see or write this organization's stock", async ({
	page,
	browser
}) => {
	await signIn(page, STOCK_OWNER_EMAIL, STOCK_OWNER_PASSWORD);

	const itemName = uniqueName('E2E Denied Stock Item');
	await page.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(itemName);
	await page.getByLabel('Price (USD)').fill('45.00');
	await selectMaterialType(page, 'Jersey', 'jersey');
	await stockInput(page, 'M').fill('9');
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');

	await page.getByRole('link', { name: itemName }).click();
	await page.waitForLoadState('networkidle');
	const editUrl = page.url();

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0009_catalog_item_stock_rls.sql: visiting the
	// item's edit URL directly 404s (RLS hides the item itself), so its
	// stock is never reachable from another organization.
	await secondOrgPage.goto(editUrl);
	await expect(secondOrgPage.getByText('Item not found')).toBeVisible();

	await secondOrgContext.close();
});
