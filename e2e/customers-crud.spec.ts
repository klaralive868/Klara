import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	CUSTOMERS_OWNER_EMAIL,
	CUSTOMERS_OWNER_PASSWORD,
	SECOND_ORG_EMAIL_B as SECOND_ORG_EMAIL,
	SECOND_ORG_PASSWORD_B as SECOND_ORG_PASSWORD
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

test('create a customer with core and dynamic fields, then edit it and confirm the changes round-trip', async ({
	page
}) => {
	await signIn(page, CUSTOMERS_OWNER_EMAIL, CUSTOMERS_OWNER_PASSWORD);

	const name = uniqueName('E2E Customer');
	await page.goto('/dashboard/customers/new');
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Email').fill('e2e-customer@example.com');
	await page.getByLabel('Phone').fill('555-0100');
	await page.getByLabel('Pet name').fill('Rex');
	await page.getByLabel('Preferred groomer').selectOption('Alex');
	await page.getByRole('button', { name: 'Add customer' }).click();

	await expect(page).toHaveURL('/dashboard/customers');
	const row = page.getByRole('row').filter({ hasText: name });
	await expect(row).toBeVisible();
	await expect(row).toContainText('e2e-customer@example.com');
	await expect(row).toContainText('555-0100');
	await expect(row).toContainText('manual');
	await expect(row).toContainText('active');

	await row.getByRole('link', { name: 'Edit' }).click();
	await expect(page.getByRole('heading', { name: 'Edit customer' })).toBeVisible();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
	await expect(page.getByLabel('Pet name')).toHaveValue('Rex');
	await expect(page.getByLabel('Preferred groomer')).toHaveValue('Alex');

	const editedName = `${name} (edited)`;
	await page.getByLabel('Name', { exact: true }).fill(editedName);
	await page.getByLabel('Pet name').fill('Rex Jr.');
	await page.getByLabel('Preferred groomer').selectOption('Sam');
	await page.getByRole('button', { name: 'Save customer' }).click();

	await expect(page.getByRole('status')).toHaveText('Customer saved.');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(editedName);
	await expect(page.getByLabel('Pet name')).toHaveValue('Rex Jr.');
	await expect(page.getByLabel('Preferred groomer')).toHaveValue('Sam');

	// Reload from the server and confirm the edit persisted, not just the
	// in-memory form state.
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(editedName);
	await expect(page.getByLabel('Pet name')).toHaveValue('Rex Jr.');
	await expect(page.getByLabel('Preferred groomer')).toHaveValue('Sam');

	await page.goto('/dashboard/customers');
	await expect(page.getByRole('row').filter({ hasText: editedName })).toBeVisible();
});

test('the server rejects a submission missing a required dynamic field, even with client-side validation bypassed', async ({
	page
}) => {
	await signIn(page, CUSTOMERS_OWNER_EMAIL, CUSTOMERS_OWNER_PASSWORD);
	await page.goto('/dashboard/customers/new');

	// Simulates a tampered/direct POST (the actual attack surface) rather
	// than relying on the browser's own `required` attribute, which would
	// just block the click and never reach the server at all — same
	// reasoning as auth.spec.ts's direct-POST test for set-password.
	const body = await page.evaluate(async () => {
		const res = await fetch(location.pathname, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ fullName: 'No Pet Name Customer' })
		});
		return res.json();
	});
	expect(body).toMatchObject({ type: 'failure', status: 400 });
	expect(JSON.stringify(body)).toContain('Pet name is required.');
});

test('the server rejects a select value that is not one of the field definition\'s options', async ({
	page
}) => {
	await signIn(page, CUSTOMERS_OWNER_EMAIL, CUSTOMERS_OWNER_PASSWORD);
	await page.goto('/dashboard/customers/new');

	const body = await page.evaluate(async () => {
		const res = await fetch(location.pathname, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				fullName: 'Bad Groomer Customer',
				field_pet_name: 'Rex',
				field_preferred_groomer: 'Not A Real Groomer'
			})
		});
		return res.json();
	});
	expect(body).toMatchObject({ type: 'failure', status: 400 });
	expect(JSON.stringify(body)).toContain('Preferred groomer must be one of the allowed options.');
});

test('submitting a case-variant of an existing customer\'s email is rejected as a validation error, not a server error', async ({
	page
}) => {
	await signIn(page, CUSTOMERS_OWNER_EMAIL, CUSTOMERS_OWNER_PASSWORD);

	const firstName = uniqueName('E2E Duplicate Email Customer');
	const email = `e2e-dup-${Date.now()}@example.com`;

	await page.goto('/dashboard/customers/new');
	await page.getByLabel('Name', { exact: true }).fill(firstName);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Pet name').fill('Rex');
	await page.getByRole('button', { name: 'Add customer' }).click();
	await expect(page).toHaveURL('/dashboard/customers');

	// Same address, different casing — the DB's case-insensitive unique
	// index rejects this insert; the form should surface it as an ordinary
	// validation message, not the generic 500 every other insert failure
	// falls back to.
	await page.goto('/dashboard/customers/new');
	await page.getByLabel('Name', { exact: true }).fill(uniqueName('E2E Duplicate Email Customer Two'));
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Pet name').fill('Fido');
	await page.getByRole('button', { name: 'Add customer' }).click();

	await expect(page.getByText('A customer with this email already exists in your organization.')).toBeVisible();
	await expect(page).toHaveURL('/dashboard/customers/new');
});

test("a different organization's member cannot see or edit this organization's customers", async ({
	page,
	browser
}) => {
	await signIn(page, CUSTOMERS_OWNER_EMAIL, CUSTOMERS_OWNER_PASSWORD);

	const name = uniqueName('E2E Denied Customer');
	await page.goto('/dashboard/customers/new');
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Pet name').fill('Rex');
	await page.getByRole('button', { name: 'Add customer' }).click();
	await expect(page).toHaveURL('/dashboard/customers');

	const editHref = await page
		.getByRole('row')
		.filter({ hasText: name })
		.getByRole('link', { name: 'Edit' })
		.getAttribute('href');
	if (!editHref) throw new Error('e2e setup failure: could not resolve the created customer URL');

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0010_customers_rls.sql at the DB layer — this
	// asserts the same denial at the application layer (defense-in-depth):
	// the other org's list never shows this customer, and visiting its edit
	// URL directly 404s rather than leaking the row.
	await secondOrgPage.goto('/dashboard/customers');
	await expect(secondOrgPage.getByRole('row').filter({ hasText: name })).toHaveCount(0);

	await secondOrgPage.goto(editHref);
	await expect(secondOrgPage.getByText('Customer not found')).toBeVisible();

	await secondOrgContext.close();
});

test('an organization with zero field definitions sees only the required Name field — email/phone are toggleable, not always-on', async ({
	page
}) => {
	// ADR-0011: a brand-new organization starts minimal. SECOND_ORG_EMAIL's
	// org has no field_definitions rows at all (never had email/phone
	// activated, unlike the main e2e org — see global-setup.ts), so its
	// customer form shows only the one field every customer unconditionally
	// requires.
	await signIn(page, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);
	await page.goto('/dashboard/customers/new');

	await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Email')).toHaveCount(0);
	await expect(page.getByLabel('Phone')).toHaveCount(0);
	await expect(page.locator('form input, form select')).toHaveCount(1);
});
