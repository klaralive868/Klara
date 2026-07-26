import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	INQUIRIES_OWNER_EMAIL,
	INQUIRIES_OWNER_PASSWORD,
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

async function logInquiry(page: Page, customerName: string, customerEmail: string) {
	// networkidle, not the default 'load' — the "+ Create new customer"
	// button is a custom JS-driven control (no native input to fall back
	// on), so a click before hydration finishes is a structural no-op, not
	// a retryable miss (same reasoning as booking-crud.spec.ts).
	await page.goto('/dashboard/inquiries/new', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '+ Create new customer' }).click();
	await page.getByLabel('Full name').fill(customerName);
	await page.getByLabel('Email').fill(customerEmail);
	await page.getByRole('button', { name: 'Add customer' }).click();
	await expect(page.getByText(customerName)).toBeVisible();

	await page.getByLabel('Trip description').fill('A week in the Alps, exact dates flexible.');
	await page.getByLabel('Party size').fill('2');
	await page.getByRole('button', { name: 'Log inquiry' }).click();
	await expect(page).toHaveURL('/dashboard/inquiries');
}

test('log an inquiry manually, then start progress, then convert', async ({ page }) => {
	await signIn(page, INQUIRIES_OWNER_EMAIL, INQUIRIES_OWNER_PASSWORD);

	const customerName = uniqueName('E2E Inquiry Customer');
	const customerEmail = `e2e-inquiry-customer-${Date.now()}@example.com`;
	await logInquiry(page, customerName, customerEmail);

	const row = page.getByText(customerName);
	await expect(row).toBeVisible();

	await row.click();
	await expect(page.getByText('new', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Start progress' }).click();
	await expect(page.getByRole('status')).toHaveText('Inquiry marked in progress.');
	await expect(page.getByText('in-progress', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Convert' }).click();
	await expect(page.getByRole('status')).toHaveText('Inquiry converted.');
	await expect(page.getByText('converted', { exact: true })).toBeVisible();
});

test('close a new inquiry without progressing it first', async ({ page }) => {
	await signIn(page, INQUIRIES_OWNER_EMAIL, INQUIRIES_OWNER_PASSWORD);

	const customerName = uniqueName('E2E Close Customer');
	const customerEmail = `e2e-close-customer-${Date.now()}@example.com`;
	await logInquiry(page, customerName, customerEmail);

	await page.getByText(customerName).click();
	await page.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('status')).toHaveText('Inquiry closed.');
	await expect(page.getByText('closed', { exact: true })).toBeVisible();
});

test("a different organization's member cannot see or write this organization's inquiries", async ({
	page,
	browser
}) => {
	await signIn(page, INQUIRIES_OWNER_EMAIL, INQUIRIES_OWNER_PASSWORD);

	const customerName = uniqueName('E2E Cross Org Inquiry Customer');
	const customerEmail = `e2e-cross-org-inquiry-customer-${Date.now()}@example.com`;
	await logInquiry(page, customerName, customerEmail);

	const ownInquiryHref = await page.getByText(customerName).getAttribute('href');
	if (!ownInquiryHref) {
		throw new Error('e2e setup failure: could not resolve the created inquiry URL');
	}

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0013_travel_inquiries_rls.sql at the DB layer:
	// the other org's list never shows this inquiry, and visiting its detail
	// URL directly 404s rather than leaking the row.
	await secondOrgPage.goto('/dashboard/inquiries');
	await expect(secondOrgPage.getByText(customerName)).toHaveCount(0);

	await secondOrgPage.goto(ownInquiryHref);
	await expect(secondOrgPage.getByText('Inquiry not found')).toBeVisible();

	await secondOrgContext.close();
});
