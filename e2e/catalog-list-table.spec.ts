import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD } from './test-user';

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

async function createItem(
	page: Page,
	name: string,
	materialLabel: string,
	materialKey: string,
	price: string,
	categoryName?: string
) {
	await page.goto('/dashboard/catalog/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Price (USD)').fill(price);
	await selectMaterialType(page, materialLabel, materialKey);
	if (categoryName) {
		await page.getByLabel(categoryName).check();
	}
	await page.getByRole('button', { name: 'Save item' }).click();
	await expect(page).toHaveURL('/dashboard/catalog');
}

test('search filters the table by item name', async ({ page }) => {
	await signIn(page, LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD);

	const nameA = uniqueName('Table Search Alpha');
	const nameB = uniqueName('Table Search Beta');
	await createItem(page, nameA, 'Jersey', 'jersey', '10.00');
	await createItem(page, nameB, 'Jersey', 'jersey', '10.00');

	await page.goto('/dashboard/catalog', { waitUntil: 'networkidle' });
	await expect(page.getByRole('row').filter({ hasText: nameA })).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: nameB })).toBeVisible();

	await page.getByLabel('Search items by name').fill(nameA);
	await expect(page.getByRole('row').filter({ hasText: nameA })).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: nameB })).toHaveCount(0);
});

test('material type filter narrows the table to the selected types', async ({ page }) => {
	await signIn(page, LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD);

	const jerseyName = uniqueName('Table Material Jersey');
	const shortsName = uniqueName('Table Material Shorts');
	await createItem(page, jerseyName, 'Jersey', 'jersey', '10.00');
	await createItem(page, shortsName, 'Shorts', 'shorts', '10.00');

	await page.goto('/dashboard/catalog', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Material type' }).click();
	await page.getByRole('option', { name: 'Jersey' }).click();
	await page.keyboard.press('Escape');

	await expect(page.getByRole('row').filter({ hasText: jerseyName })).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: shortsName })).toHaveCount(0);
});

test('status filter narrows the table to the selected statuses', async ({ page }) => {
	await signIn(page, LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD);

	const draftName = uniqueName('Table Status Draft');
	const toArchiveName = uniqueName('Table Status Archived');
	await createItem(page, draftName, 'Jersey', 'jersey', '10.00');
	await createItem(page, toArchiveName, 'Jersey', 'jersey', '10.00');

	await page.goto('/dashboard/catalog', { waitUntil: 'networkidle' });
	await page
		.getByRole('row')
		.filter({ hasText: toArchiveName })
		.getByRole('checkbox', { name: 'Select row' })
		.check();
	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByRole('status')).toHaveText('1 item(s) archived.');

	await page.getByRole('button', { name: 'Status' }).click();
	await page.getByRole('option', { name: 'Archived' }).click();
	await page.keyboard.press('Escape');

	await expect(page.getByRole('row').filter({ hasText: toArchiveName })).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: draftName })).toHaveCount(0);
});

test('multi-select then bulk archive updates every selected row', async ({ page }) => {
	await signIn(page, LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD);

	const nameA = uniqueName('Table Bulk Archive A');
	const nameB = uniqueName('Table Bulk Archive B');
	await createItem(page, nameA, 'Jersey', 'jersey', '10.00');
	await createItem(page, nameB, 'Jersey', 'jersey', '10.00');

	await page.goto('/dashboard/catalog', { waitUntil: 'networkidle' });
	await page
		.getByRole('row')
		.filter({ hasText: nameA })
		.getByRole('checkbox', { name: 'Select row' })
		.check();
	await page
		.getByRole('row')
		.filter({ hasText: nameB })
		.getByRole('checkbox', { name: 'Select row' })
		.check();

	await expect(page.getByText('2 selected')).toBeVisible();
	await page.getByRole('button', { name: 'Archive' }).click();

	await expect(page.getByRole('status')).toHaveText('2 item(s) archived.');
	await expect(page.getByRole('row').filter({ hasText: nameA })).toContainText('archived');
	await expect(page.getByRole('row').filter({ hasText: nameB })).toContainText('archived');

	// The selection and the contextual action bar both clear after a
	// successful bulk action — the row checkboxes uncheck themselves.
	await expect(page.getByText('2 selected')).toHaveCount(0);
});

test('bulk publish requires a category and reports items it had to skip', async ({ page }) => {
	await signIn(page, LIST_TABLE_OWNER_EMAIL, LIST_TABLE_OWNER_PASSWORD);

	const categoryName = uniqueName('Table Bulk Publish Category');
	await page.goto('/dashboard/catalog/categories', { waitUntil: 'networkidle' });
	await page.getByLabel('New top-level category name').fill(categoryName);
	await page.getByRole('button', { name: 'Add category' }).click();
	await page.waitForLoadState('networkidle');

	const publishableName = uniqueName('Table Bulk Publishable');
	const unpublishableName = uniqueName('Table Bulk Unpublishable');
	await createItem(page, publishableName, 'Jersey', 'jersey', '10.00', categoryName);
	await createItem(page, unpublishableName, 'Jersey', 'jersey', '10.00');

	await page.goto('/dashboard/catalog', { waitUntil: 'networkidle' });
	await page
		.getByRole('row')
		.filter({ hasText: publishableName })
		.getByRole('checkbox', { name: 'Select row' })
		.check();
	await page
		.getByRole('row')
		.filter({ hasText: unpublishableName })
		.getByRole('checkbox', { name: 'Select row' })
		.check();

	await page.getByRole('button', { name: 'Publish' }).click();

	await expect(page.getByRole('status')).toHaveText(
		'1 item(s) published. 1 skipped (already published, or needs a category first).'
	);
	await expect(page.getByRole('row').filter({ hasText: publishableName })).toContainText(
		'published'
	);
	await expect(page.getByRole('row').filter({ hasText: unpublishableName })).toContainText('draft');
});
