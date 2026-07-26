import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
	BOOKINGS_OWNER_EMAIL,
	BOOKINGS_OWNER_PASSWORD,
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

async function createResource(page: Page, name: string, quantity?: string) {
	// networkidle, not the default 'load' — the "Set a seat limit" checkbox
	// is a custom JS-driven control (no native input to fall back on), so a
	// click before hydration finishes is a structural no-op, not a retryable
	// miss (same reasoning applies to the "+ Create new customer" button
	// below).
	await page.goto('/dashboard/resources/new', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Departure date').fill('2026-08-12');
	await page.getByLabel('Return date').fill('2026-08-19');
	await page.getByLabel('Price (USD)').fill('500.00');
	if (quantity) {
		await page.getByLabel('Set a seat limit').check();
		await page.locator('input[name="quantity"]').fill(quantity);
	}
	await page.getByRole('button', { name: 'Add resource' }).click();
	await expect(page).toHaveURL('/dashboard/resources');
}

test('log a booking manually, then confirm, then mark completed', async ({ page }) => {
	await signIn(page, BOOKINGS_OWNER_EMAIL, BOOKINGS_OWNER_PASSWORD);

	const resourceName = uniqueName('E2E Booking Resource');
	await createResource(page, resourceName);

	const customerName = uniqueName('E2E Booking Customer');
	const customerEmail = `e2e-booking-customer-${Date.now()}@example.com`;

	await page.goto('/dashboard/bookings/new', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '+ Create new customer' }).click();
	await page.getByLabel('Full name').fill(customerName);
	await page.getByLabel('Email').fill(customerEmail);
	await page.getByRole('button', { name: 'Add customer' }).click();
	await expect(page.getByText(customerName)).toBeVisible();

	await page.getByLabel('Package').selectOption({ label: resourceName });
	await page.getByLabel('Traveler count').fill('2');
	await page.getByRole('button', { name: 'Log booking' }).click();

	await expect(page).toHaveURL('/dashboard/bookings');
	const row = page.getByText(customerName);
	await expect(row).toBeVisible();

	await row.click();
	await expect(page.getByText('pending', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Confirm' }).click();
	await expect(page.getByRole('status')).toHaveText('Booking confirmed.');
	await expect(page.getByText('confirmed', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Mark completed' }).click();
	await expect(page.getByRole('status')).toHaveText('Booking marked completed.');
	await expect(page.getByText('completed', { exact: true })).toBeVisible();
});

test('cancel a pending booking', async ({ page }) => {
	await signIn(page, BOOKINGS_OWNER_EMAIL, BOOKINGS_OWNER_PASSWORD);

	const resourceName = uniqueName('E2E Cancellable Resource');
	await createResource(page, resourceName);

	const customerName = uniqueName('E2E Cancel Customer');
	const customerEmail = `e2e-cancel-customer-${Date.now()}@example.com`;

	await page.goto('/dashboard/bookings/new', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '+ Create new customer' }).click();
	await page.getByLabel('Full name').fill(customerName);
	await page.getByLabel('Email').fill(customerEmail);
	await page.getByRole('button', { name: 'Add customer' }).click();

	await page.getByLabel('Package').selectOption({ label: resourceName });
	await page.getByLabel('Traveler count').fill('1');
	await page.getByRole('button', { name: 'Log booking' }).click();

	await expect(page).toHaveURL('/dashboard/bookings');
	await page.getByText(customerName).click();

	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('status')).toHaveText('Booking cancelled.');
	await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
});

test('a resource with a seat limit shows confirmed and pending counts', async ({ page }) => {
	await signIn(page, BOOKINGS_OWNER_EMAIL, BOOKINGS_OWNER_PASSWORD);

	const resourceName = uniqueName('E2E Capacity Resource');
	await createResource(page, resourceName, '10');

	const customerName = uniqueName('E2E Capacity Customer');
	const customerEmail = `e2e-capacity-customer-${Date.now()}@example.com`;

	await page.goto('/dashboard/bookings/new', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '+ Create new customer' }).click();
	await page.getByLabel('Full name').fill(customerName);
	await page.getByLabel('Email').fill(customerEmail);
	await page.getByRole('button', { name: 'Add customer' }).click();

	await page.getByLabel('Package').selectOption({ label: resourceName });
	await page.getByLabel('Traveler count').fill('3');
	await page.getByRole('button', { name: 'Log booking' }).click();
	await expect(page).toHaveURL('/dashboard/bookings');

	await page.goto('/dashboard/resources');
	await page.getByRole('link', { name: resourceName }).click();
	await expect(page.getByText('0 confirmed · 3 pending · 10 capacity')).toBeVisible();

	// Confirming moves the traveler count from pending to confirmed, and the
	// resource page reflects it without blocking on the seat limit — this
	// booking (3) plus a hypothetical future one could still exceed capacity
	// and nothing here should prevent it (capacity is informational only).
	await page.goto('/dashboard/bookings');
	await page.getByText(customerName).click();
	await page.getByRole('button', { name: 'Confirm' }).click();

	await page.goto('/dashboard/resources');
	await page.getByRole('link', { name: resourceName }).click();
	await expect(page.getByText('3 confirmed · 0 pending · 10 capacity')).toBeVisible();
});

test("a different organization's member cannot see or write this organization's bookings", async ({
	page,
	browser
}) => {
	await signIn(page, BOOKINGS_OWNER_EMAIL, BOOKINGS_OWNER_PASSWORD);

	const resourceName = uniqueName('E2E Cross Org Resource');
	await createResource(page, resourceName);

	const customerName = uniqueName('E2E Cross Org Customer');
	const customerEmail = `e2e-cross-org-customer-${Date.now()}@example.com`;

	await page.goto('/dashboard/bookings/new', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: '+ Create new customer' }).click();
	await page.getByLabel('Full name').fill(customerName);
	await page.getByLabel('Email').fill(customerEmail);
	await page.getByRole('button', { name: 'Add customer' }).click();

	await page.getByLabel('Package').selectOption({ label: resourceName });
	await page.getByLabel('Traveler count').fill('1');
	await page.getByRole('button', { name: 'Log booking' }).click();
	await expect(page).toHaveURL('/dashboard/bookings');

	const ownBookingHref = await page.getByText(customerName).getAttribute('href');
	if (!ownBookingHref) {
		throw new Error('e2e setup failure: could not resolve the created booking URL');
	}

	const secondOrgContext = await browser.newContext();
	const secondOrgPage = await secondOrgContext.newPage();
	await signIn(secondOrgPage, SECOND_ORG_EMAIL, SECOND_ORG_PASSWORD);

	// Mirrors supabase/tests/0012_bookings_rls.sql at the DB layer: the other
	// org's list never shows this booking, and visiting its detail URL
	// directly 404s rather than leaking the row.
	await secondOrgPage.goto('/dashboard/bookings');
	await expect(secondOrgPage.getByText(customerName)).toHaveCount(0);

	await secondOrgPage.goto(ownBookingHref);
	await expect(secondOrgPage.getByText('Booking not found')).toBeVisible();

	await secondOrgContext.close();
});
