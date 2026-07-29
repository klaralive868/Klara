import { expect, test } from '@playwright/test';
import {
	createAdminClient,
	E2E_BOOKING_ALLOWED_ORIGIN,
	E2E_BOOKING_ORG_SLUG,
	E2E_BOOKING_PUBLISHED_RESOURCE_NAME,
	E2E_SECOND_ORG_SLUG
} from './admin-client';

const DISALLOWED_ORIGIN = 'https://not-on-the-list.example';

async function resourceIdByName(name: string) {
	const admin = createAdminClient();
	const { data, error } = await admin.from('resources').select('id').eq('name', name).single();
	if (error || !data) {
		throw new Error(`e2e setup failure: could not resolve resource "${name}": ${error?.message}`);
	}
	return data.id as string;
}

function uniqueEmail(label: string) {
	return `e2e-api-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('OPTIONS preflight from an allowed origin returns CORS headers', async ({ request }) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const response = await request.fetch(
		`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}/book`,
		{ method: 'OPTIONS', headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN } }
	);
	expect(response.status()).toBe(204);
	expect(response.headers()['access-control-allow-origin']).toBe(E2E_BOOKING_ALLOWED_ORIGIN);
	expect(response.headers()['access-control-allow-methods']).toContain('POST');
});

test('lists and fetches published resources from an allowed origin', async ({ request }) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);

	const listResponse = await request.get(`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources`, {
		headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN }
	});
	expect(listResponse.ok()).toBe(true);
	expect(listResponse.headers()['access-control-allow-origin']).toBe(E2E_BOOKING_ALLOWED_ORIGIN);
	const listBody = await listResponse.json();
	expect(listBody.data.some((r: { id: string }) => r.id === publishedId)).toBe(true);

	const detailResponse = await request.get(
		`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}`,
		{ headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN } }
	);
	expect(detailResponse.ok()).toBe(true);
	const detailBody = await detailResponse.json();
	expect(detailBody.data.id).toBe(publishedId);
});

test('a GET from an origin not on the allowlist is rejected', async ({ request }) => {
	const response = await request.get(`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources`, {
		headers: { origin: DISALLOWED_ORIGIN }
	});
	expect(response.status()).toBe(403);
	expect(response.headers()['access-control-allow-origin']).toBeUndefined();
});

test('a GET with no Origin header at all is rejected', async ({ request }) => {
	// Playwright's `request` fixture doesn't send Origin by default (it isn't
	// a browser context), so this exercises the fail-closed missing-header
	// path directly without needing to strip a header a browser would add.
	const response = await request.get(`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources`);
	expect(response.status()).toBe(403);
});

test('an unknown org slug 404s regardless of origin', async ({ request }) => {
	const response = await request.get(`/api/v1/bookings/no-such-org-at-all/resources`, {
		headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN }
	});
	expect(response.status()).toBe(404);
});

test('submits a booking via the API from an allowed origin', async ({ request }) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('book');

	const response = await request.post(
		`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}/book`,
		{
			headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN },
			data: { name: 'API Visitor', email, travelerCount: '2' }
		}
	);
	expect(response.status()).toBe(201);

	const admin = createAdminClient();
	const { data: customer } = await admin
		.from('customers')
		.select('id, source')
		.eq('email', email)
		.single();
	expect(customer?.source).toBe('booking');

	const { data: booking } = await admin
		.from('bookings')
		.select('status, traveler_count')
		.eq('resource_id', publishedId)
		.eq('customer_id', customer!.id)
		.single();
	expect(booking?.status).toBe('pending');
	expect(booking?.traveler_count).toBe(2);
});

test('a booking POST from an origin not on the allowlist is rejected and writes nothing', async ({
	request
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('rejected-origin');

	const response = await request.post(
		`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}/book`,
		{
			headers: { origin: DISALLOWED_ORIGIN },
			data: { name: 'Should Not Book', email, travelerCount: '1' }
		}
	);
	expect(response.status()).toBe(403);

	const admin = createAdminClient();
	const { data: customer } = await admin
		.from('customers')
		.select('id')
		.eq('email', email)
		.maybeSingle();
	expect(customer).toBeNull();
});

test('submits an inquiry via the API from an allowed origin', async ({ request }) => {
	const email = uniqueEmail('inquiry');

	const response = await request.post(`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/inquiries`, {
		headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN },
		data: { name: 'API Inquirer', email, tripDescription: 'A trip through the Alps.' }
	});
	expect(response.status()).toBe(201);

	const admin = createAdminClient();
	const { data: customer } = await admin
		.from('customers')
		.select('id, source')
		.eq('email', email)
		.single();
	expect(customer?.source).toBe('inquiry');

	const { data: inquiry } = await admin
		.from('travel_inquiries')
		.select('status, trip_description')
		.eq('customer_id', customer!.id)
		.single();
	expect(inquiry?.status).toBe('new');
	expect(inquiry?.trip_description).toBe('A trip through the Alps.');
});

test('rate limiting kicks in on the API booking endpoint after repeated submissions', async ({
	request
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('rate-limit');

	for (let i = 0; i < 5; i++) {
		const response = await request.post(
			`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}/book`,
			{
				headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN },
				data: { name: 'Rate Limited API Visitor', email, travelerCount: '1' }
			}
		);
		expect(response.status()).toBe(201);
	}

	const response = await request.post(
		`/api/v1/bookings/${E2E_BOOKING_ORG_SLUG}/resources/${publishedId}/book`,
		{
			headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN },
			data: { name: 'Rate Limited API Visitor', email, travelerCount: '1' }
		}
	);
	expect(response.status()).toBe(429);
});

test('one organization\'s API endpoints are never reachable through another organization\'s slug', async ({
	request
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);

	// E2E_SECOND_ORG also allows this origin (global-setup) — this request
	// passes the CORS gate, so the 404 below is genuinely org-scoped
	// resource lookup, not an incidental CORS rejection.
	const response = await request.get(
		`/api/v1/bookings/${E2E_SECOND_ORG_SLUG}/resources/${publishedId}`,
		{ headers: { origin: E2E_BOOKING_ALLOWED_ORIGIN } }
	);
	expect(response.status()).toBe(404);
});

test('the existing page-action booking and inquiry flows still work after the shared-parser refactor', async ({
	page
}) => {
	const publishedId = await resourceIdByName(E2E_BOOKING_PUBLISHED_RESOURCE_NAME);
	const email = uniqueEmail('page-action-regression');

	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/${publishedId}`);
	await page.getByLabel('Full name').fill('Page Action Visitor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Traveler count').fill('1');
	await page.getByRole('button', { name: 'Request booking' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();

	const inquiryEmail = uniqueEmail('page-action-inquiry-regression');
	await page.goto(`/book/${E2E_BOOKING_ORG_SLUG}/inquiry`);
	await page.getByLabel('Full name').fill('Page Action Inquirer');
	await page.getByLabel('Email').fill(inquiryEmail);
	await page.getByLabel(/where would you like to go/i).fill('A trip through the fjords.');
	await page.getByRole('button', { name: 'Send inquiry' }).click();
	await expect(page.getByText(/Thanks!/)).toBeVisible();
});
