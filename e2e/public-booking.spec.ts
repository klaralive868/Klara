import { expect, test } from '@playwright/test';
import {
	createAdminClient,
	E2E_BOOKING_DRAFT_RESOURCE_NAME,
	E2E_BOOKING_ORG_SLUG,
	E2E_BOOKING_PUBLISHED_RESOURCE_NAME,
	E2E_SECOND_ORG_SLUG
} from './admin-client';

async function resourceIdByName(name: string) {
	const admin = createAdminClient();
	const { data, error } = await admin.from('resources').select('id').eq('name', name).single();
	if (error || !data) {
		throw new Error(`e2e setup failure: could not resolve resource "${name}": ${error?.message}`);
	}
	return data.id as string;
}

function uniqueEmail(label: string) {
	return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('submits a booking with no session, scoped to the right organization', async ({ page }) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('visitor');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
	await page.getByLabel('Full name').fill('Jane Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Traveler count').fill('2');
	await page.getByRole('button', { name: 'Request booking' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const admin = createAdminClient();
	const { data: resource } = await admin
		.from('resources')
		.select('organization_id')
		.eq('id', publishedId)
		.single();

	const { data: customer } = await admin
		.from('customers')
		.select('id, organization_id, source')
		.eq('email', email)
		.single();
	expect(customer?.organization_id).toBe(resource?.organization_id);
	expect(customer?.source).toBe('booking');

	const { data: booking } = await admin
		.from('bookings')
		.select('status, resource_id, customer_id, traveler_count')
		.eq('resource_id', publishedId)
		.eq('customer_id', customer!.id)
		.single();
	expect(booking?.status).toBe('pending');
	expect(booking?.traveler_count).toBe(2);
});

test('a draft resource\'s public page is inaccessible', async ({ page }) => {
	const draftId = await resourceIdByName(E2E_BOOKING_DRAFT_RESOURCE_NAME);

	const response = await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${draftId}`);
	expect(response?.status()).toBe(404);
});

test('the same email submitting twice reuses one customer, without overwriting its name', async ({
	page
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('repeat');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
	await page.getByLabel('Full name').fill('Repeat Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Traveler count').fill('1');
	await page.getByRole('button', { name: 'Request booking' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	// Same email, different case and a different name — should match the
	// existing customer rather than creating a second one or renaming it.
	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
	await page.getByLabel('Full name').fill('Someone Else Entirely');
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Traveler count').fill('3');
	await page.getByRole('button', { name: 'Request booking' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const admin = createAdminClient();
	const { data: customers } = await admin
		.from('customers')
		.select('id, full_name')
		.ilike('email', email);
	expect(customers).toHaveLength(1);
	expect(customers?.[0].full_name).toBe('Repeat Visitor');

	const { data: bookings } = await admin
		.from('bookings')
		.select('id')
		.eq('customer_id', customers![0].id);
	expect(bookings).toHaveLength(2);
});

test('one organization\'s public page is never reachable through another organization\'s slug', async ({
	page
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);

	const response = await page.goto(`/book/${E2E_SECOND_ORG_SLUG}/${publishedId}`);
	expect(response?.status()).toBe(404);
});

test('rate limiting kicks in after repeated submissions', async ({ page }) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('rate-limit');

	for (let i = 0; i < 5; i++) {
		await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
		await page.getByLabel('Full name').fill('Rate Limited Visitor');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Traveler count').fill('1');
		await page.getByRole('button', { name: 'Request booking' }).click();
		await expect(page.getByText(/Thanks!/)).toBeVisible();
	}

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
	await page.getByLabel('Full name').fill('Rate Limited Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Traveler count').fill('1');
	await page.getByRole('button', { name: 'Request booking' }).click();
	await expect(page.getByText('Too many requests. Please try again later.')).toBeVisible();
});
