import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	RESOURCES_OWNER_EMAIL,
	RESOURCES_OWNER_PASSWORD,
	SECOND_ORG_EMAIL_C as SECOND_ORG_EMAIL,
	SECOND_ORG_PASSWORD_C as SECOND_ORG_PASSWORD
} from './test-user';

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
}

function uniqueResourceName(label: string) {
	return `${label} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test('create a resource end-to-end, then edit it', async ({ page }) => {
	await signIn(page, RESOURCES_OWNER_EMAIL, RESOURCES_OWNER_PASSWORD);

	const resourceName = uniqueResourceName('E2E Bali Tour');

	await page.goto('/dashboard/resources/new');
	await page.getByLabel('Name').fill(resourceName);
	await page.getByLabel('Description').fill('A resource created by an e2e test.');
	await page.getByLabel('Departure date').fill('2026-08-12');
	await page.getByLabel('Return date').fill('2026-08-19');
	await page.getByLabel('Price (USD)').fill('1999.99');
	await page.getByRole('button', { name: 'Add resource' }).click();

	await expect(page).toHaveURL('/dashboard/resources');
	const row = page.locator('li').filter({ hasText: resourceName });
	await expect(row).toBeVisible();
	await expect(row).toContainText('$1999.99');
	await expect(row).toContainText('No seat limit');
	await expect(row).toContainText('draft');

	await row.getByRole('link', { name: resourceName }).click();
	await expect(page.getByRole('heading', { name: 'Edit resource' })).toBeVisible();
	await expect(page.getByLabel('Name')).toHaveValue(resourceName);
	await expect(page.getByLabel('Price (USD)')).toHaveValue('1999.99');

	const editedName = `${resourceName} (edited)`;
	await page.getByLabel('Name').fill(editedName);
	await page.getByLabel('Price (USD)').fill('2500.00');
	await page.getByRole('button', { name: 'Save resource' }).click();

	await expect(page.getByRole('status')).toHaveText('Resource saved.');
	await expect(page.getByLabel('Name')).toHaveValue(editedName);
	await expect(page.getByLabel('Price (USD)')).toHaveValue('2500.00');

	await page.goto('/dashboard/resources');
	await expect(page.locator('li').filter({ hasText: editedName })).toBeVisible();
});

test('publish, archive, then unarchive a resource', async ({ page }) => {
	await signIn(page, RESOURCES_OWNER_EMAIL, RESOURCES_OWNER_PASSWORD);

	const resourceName = uniqueResourceName('E2E Publishable');

	await page.goto('/dashboard/resources/new');
	await page.getByLabel('Name').fill(resourceName);
	await page.getByLabel('Departure date').fill('2026-09-01');
	await page.getByLabel('Return date').fill('2026-09-08');
	await page.getByLabel('Price (USD)').fill('500.00');
	await page.getByRole('button', { name: 'Add resource' }).click();
	await expect(page).toHaveURL('/dashboard/resources');

	await page.getByRole('link', { name: resourceName }).click();
	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('status')).toHaveText('Resource published.');
	await expect(page.getByText('Status: published')).toBeVisible();

	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByRole('status')).toHaveText('Resource archived.');
	await expect(page.getByText('Status: archived')).toBeVisible();

	await page.getByRole('button', { name: 'Unarchive' }).click();
	await expect(page.getByRole('status')).toHaveText('Resource restored to draft.');
	await expect(page.getByText('Status: draft')).toBeVisible();

	await page.goto('/dashboard/resources');
	await expect(
		page.locator('li').filter({ hasText: resourceName }).getByText('draft')
	).toBeVisible();
});

test("the resource list only shows the caller's own organization's resources, and a foreign resource id 404s", async ({
	page,
	browser
}) => {
	await signIn(page, RESOURCES_OWNER_EMAIL, RESOURCES_OWNER_PASSWORD);

	const ownResourceName = uniqueResourceName('E2E Own Org Resource');
	await page.goto('/dashboard/resources/new');
	await page.getByLabel('Name').fill(ownResourceName);
	await page.getByLabel('Departure date').fill('2026-10-01');
	await page.getByLabel('Return date').fill('2026-10-08');
	await page.getByLabel('Price (USD)').fill('300.00');
	await page.getByRole('button', { name: 'Add resource' }).click();
	await expect(page).toHaveURL('/dashboard/resources');

	const ownResourceHref = await page
		.getByRole('link', { name: ownResourceName })
		.getAttribute('href');
	if (!ownResourceHref) {
		throw new Error('e2e setup failure: could not resolve the created resource URL');
	}

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Cross-organization denied-access, exercised through the actual UI/session
	// (mirroring supabase/tests/0011_resources_rls.sql): the other org's list
	// never shows this resource, and visiting its edit URL directly 404s.
	await secondOrgPage.goto('/dashboard/resources');
	await expect(secondOrgPage.locator('li').filter({ hasText: ownResourceName })).toHaveCount(0);

	await secondOrgPage.goto(ownResourceHref);
	await expect(secondOrgPage.getByText('Resource not found')).toBeVisible();

	await secondOrgContext.close();
});
