import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	FIELD_DEFINITIONS_OWNER_EMAIL,
	FIELD_DEFINITIONS_OWNER_PASSWORD,
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

function uniqueLabel(label: string) {
	return `${label} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// All three tests share one organization (FIELD_DEFINITIONS_OWNER_EMAIL's)
// and mutate its field_definitions/customers directly — serialized so they
// can't interleave (same pattern as public-inquiry.spec.ts), since
// fullyParallel would otherwise run them concurrently against the same
// shared, mutable org state.
test.describe.serial('field definitions management', () => {
	test('a brand-new organization sees core fields as available-but-off, turning one on makes it appear on the customer form', async ({
		page
	}) => {
		await signIn(page, FIELD_DEFINITIONS_OWNER_EMAIL, FIELD_DEFINITIONS_OWNER_PASSWORD);

		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		const emailRow = page.getByRole('row').filter({ hasText: 'Email' });
		await expect(emailRow.getByRole('button', { name: 'Show' })).toBeVisible();
		await expect(page.getByText('No custom fields yet.')).toBeVisible();

		await page.goto('/dashboard/customers/new', { waitUntil: 'networkidle' });
		await expect(page.getByLabel('Email')).toHaveCount(0);

		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await emailRow.getByRole('button', { name: 'Show' }).click();
		await expect(page.getByRole('status')).toContainText('shown');
		await expect(emailRow.getByRole('button', { name: 'Hide' })).toBeVisible();

		await page.goto('/dashboard/customers/new', { waitUntil: 'networkidle' });
		await expect(page.getByLabel('Email')).toBeVisible();
	});

	test('adding a custom field makes it self-serve — no operator step — and soft-hiding it preserves existing data', async ({
		page
	}) => {
		await signIn(page, FIELD_DEFINITIONS_OWNER_EMAIL, FIELD_DEFINITIONS_OWNER_PASSWORD);

		const fieldLabel = uniqueLabel('Loyalty points');
		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await page.getByLabel('Field name').fill(fieldLabel);
		await page.getByLabel('Type').selectOption('number');
		await page.getByRole('button', { name: 'Add field' }).click();
		await expect(page.getByRole('status')).toContainText('added');

		const fieldRow = page.getByRole('row').filter({ hasText: fieldLabel });
		await expect(fieldRow.getByRole('button', { name: 'Hide' })).toBeVisible();

		// It appears on the create form immediately — no operator involvement.
		const customerName = uniqueLabel('E2E Field Defs Customer');
		await page.goto('/dashboard/customers/new', { waitUntil: 'networkidle' });
		await expect(page.getByLabel(fieldLabel)).toBeVisible();
		await page.getByLabel('Name', { exact: true }).fill(customerName);
		await page.getByLabel(fieldLabel).fill('42');
		await page.getByRole('button', { name: 'Add customer' }).click();
		await expect(page).toHaveURL('/dashboard/customers');

		const customerRow = page.getByRole('row').filter({ hasText: customerName });
		await expect(customerRow).toContainText('42');

		// Soft-hide: the column disappears from the table and the field
		// disappears from the create form, but the value already stored for
		// this customer is not touched.
		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await fieldRow.getByRole('button', { name: 'Hide' }).click();
		await expect(page.getByRole('status')).toContainText('hidden');

		await page.goto('/dashboard/customers', { waitUntil: 'networkidle' });
		await expect(page.getByRole('columnheader', { name: fieldLabel })).toHaveCount(0);

		await page.goto('/dashboard/customers/new', { waitUntil: 'networkidle' });
		await expect(page.getByLabel(fieldLabel)).toHaveCount(0);

		// Re-show it — the value survives, proving it was never purged.
		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await fieldRow.getByRole('button', { name: 'Show' }).click();
		await expect(page.getByRole('status')).toContainText('shown');

		// Retried as one unit (same reasoning as catalog-categories.spec.ts's
		// checkCategory/uncheckCategory): under load, an occasional
		// networkidle-timed check can land before the reload's own data has
		// fully settled — reloading and re-checking is safe since it's
		// idempotent.
		await expect(async () => {
			await page.goto('/dashboard/customers', { waitUntil: 'networkidle' });
			await expect(page.getByRole('columnheader', { name: fieldLabel })).toBeVisible({
				timeout: 1000
			});
			await expect(page.getByRole('row').filter({ hasText: customerName })).toContainText('42', {
				timeout: 1000
			});
		}).toPass({ timeout: 30_000 });
	});

	test("a different organization's member cannot see or manage this organization's field definitions", async ({
		page
	}) => {
		await signIn(page, FIELD_DEFINITIONS_OWNER_EMAIL, FIELD_DEFINITIONS_OWNER_PASSWORD);

		const fieldLabel = uniqueLabel('Cross Org Isolation Field');
		await page.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await page.getByLabel('Field name').fill(fieldLabel);
		await page.getByLabel('Type').selectOption('text');
		await page.getByRole('button', { name: 'Add field' }).click();
		await expect(page.getByRole('status')).toContainText('added');

		// A genuinely different organization's member signs in separately and
		// must not see this field anywhere — same cross-org isolation pattern
		// as customers-crud.spec.ts, mirroring supabase/tests/0015 at the
		// application layer (defense-in-depth).
		const secondOrgContext = await page.context().browser()!.newContext();
		const secondOrgPage = await secondOrgContext.newPage();
		await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

		await secondOrgPage.goto('/dashboard/customers/fields', { waitUntil: 'networkidle' });
		await expect(secondOrgPage.getByText(fieldLabel)).toHaveCount(0);

		await secondOrgPage.goto('/dashboard/customers/new', { waitUntil: 'networkidle' });
		await expect(secondOrgPage.getByLabel(fieldLabel)).toHaveCount(0);

		await secondOrgContext.close();
	});
});
