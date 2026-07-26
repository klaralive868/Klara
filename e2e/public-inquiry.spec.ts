import { expect, test } from '@playwright/test';
import {
	createAdminClient,
	E2E_BOOKING_ORG_SLUG,
	E2E_SECOND_ORG_SLUG
} from './admin-client';

function uniqueEmail(label: string) {
	return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('submits an inquiry with no session, scoped to the right organization', async ({ page }) => {
	const email = uniqueEmail('inquiry-visitor');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Jane Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Where would you like to go?').fill('A safari through Kenya.');
	await page.getByLabel('Party size').fill('2');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const admin = createAdminClient();
	const { data: organization } = await admin
		.from('organizations')
		.select('id')
		.eq('slug', E2E_BOOKING_ORG_SLUG)
		.single();

	const { data: customer } = await admin
		.from('customers')
		.select('id, organization_id, source')
		.eq('email', email)
		.single();
	expect(customer?.organization_id).toBe(organization?.id);
	expect(customer?.source).toBe('inquiry');

	const { data: inquiry } = await admin
		.from('travel_inquiries')
		.select('status, customer_id, trip_description, party_size')
		.eq('customer_id', customer!.id)
		.single();
	expect(inquiry?.status).toBe('new');
	expect(inquiry?.trip_description).toBe('A safari through Kenya.');
	expect(inquiry?.party_size).toBe(2);
});

test('the same email submitting twice reuses one customer, without overwriting its name', async ({
	page
}) => {
	const email = uniqueEmail('inquiry-repeat');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Repeat Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Where would you like to go?').fill('First trip idea.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	// Same email, different case and a different name — should match the
	// existing customer rather than creating a second one or renaming it.
	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Someone Else Entirely');
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Where would you like to go?').fill('Second trip idea.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const admin = createAdminClient();
	const { data: customers } = await admin
		.from('customers')
		.select('id, full_name')
		.ilike('email', email);
	expect(customers).toHaveLength(1);
	expect(customers?.[0].full_name).toBe('Repeat Visitor');

	const { data: inquiries } = await admin
		.from('travel_inquiries')
		.select('id')
		.eq('customer_id', customers![0].id);
	expect(inquiries).toHaveLength(2);
});

test('the same email in two different organizations creates two separate customers', async ({
	page
}) => {
	const email = uniqueEmail('inquiry-cross-org');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('First Org Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Where would you like to go?').fill('Trip idea for org one.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	await page.goto(`/book/${E2E_SECOND_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Second Org Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Where would you like to go?').fill('Trip idea for org two.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const admin = createAdminClient();
	const { data: customers } = await admin.from('customers').select('id, organization_id, full_name').eq('email', email);
	expect(customers).toHaveLength(2);
	const organizationIds = customers!.map((c) => c.organization_id);
	expect(new Set(organizationIds).size).toBe(2);
});

test('an inquiry page is not reachable through a nonexistent organization slug', async ({ page }) => {
	const response = await page.goto('/book/no-such-organization-slug/inquiry');
	expect(response?.status()).toBe(404);
});

test('rate limiting kicks in after repeated submissions', async ({ page }) => {
	const email = uniqueEmail('inquiry-rate-limit');

	for (let i = 0; i < 5; i++) {
		await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
		await page.getByLabel('Full name').fill('Rate Limited Visitor');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Where would you like to go?').fill('Somewhere warm.');
		await page.getByRole('button', { name: 'Send inquiry' }).click();
		await expect(page.getByText(/Thanks!/)).toBeVisible();
	}

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Rate Limited Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Where would you like to go?').fill('Somewhere warm.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText('Too many requests. Please try again later.')).toBeVisible();
});
