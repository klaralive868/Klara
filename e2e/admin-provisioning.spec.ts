import { expect, test } from '@playwright/test';
import { createAdminClient } from './admin-client';
import { extractConfirmUrl, getLatestEmailTo } from './mailpit';
import {
	ADMIN_PROVISIONED_ORG_NAME_PREFIX,
	ADMIN_PROVISIONED_OWNER_EMAIL_PREFIX,
	ADMIN_PROVISIONING_NON_OPERATOR_EMAIL,
	ADMIN_PROVISIONING_NON_OPERATOR_PASSWORD,
	INVITER_EMAIL,
	OPERATOR_EMAIL,
	OPERATOR_PASSWORD
} from './test-user';

function uniqueBusinessName() {
	return `${ADMIN_PROVISIONED_ORG_NAME_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function uniqueOwnerEmail() {
	return `${ADMIN_PROVISIONED_OWNER_EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signInAsOperator(page: import('@playwright/test').Page) {
	await page.goto('/sign-in', { waitUntil: 'networkidle' });
	await page.getByLabel('Email').fill(OPERATOR_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(OPERATOR_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
}

test('a non-operator posting directly to the create-client action is rejected', async ({ page }) => {
	// Same rationale as invite-claim.spec.ts's /set-password direct-POST test:
	// the (admin) layout guard runs in load() only, so a POST straight to this
	// action is the actual attack surface, not just a UI-level check. Posted
	// via fetch() inside the page (not page.request) so the real, Secure-flagged
	// session cookie is attached the way a browser genuinely would.
	await page.goto('/sign-in', { waitUntil: 'networkidle' });
	await page.getByLabel('Email').fill(ADMIN_PROVISIONING_NON_OPERATOR_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(ADMIN_PROVISIONING_NON_OPERATOR_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

	const businessName = uniqueBusinessName();
	const body = await page.evaluate(
		async ({ businessName, ownerEmail }) => {
			const res = await fetch('/admin/clients/new', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					businessName,
					ownerFullName: 'Attacker Owner',
					ownerEmail
				})
			});
			return res.json();
		},
		{ businessName, ownerEmail: uniqueOwnerEmail() }
	);
	expect(body).toMatchObject({ type: 'failure', status: 403 });

	const admin = createAdminClient();
	const { data: org } = await admin
		.from('organizations')
		.select('id')
		.eq('name', businessName)
		.maybeSingle();
	expect(org).toBeNull();
});

test('a duplicate owner email is rejected with a clear error and leaves no orphaned organization', async ({
	page
}) => {
	// INVITER_EMAIL already belongs to an active auth user (seeded by
	// global-setup for invite-claim.spec.ts), so this is a real, live trigger
	// for inviteUserByEmail's email_exists failure — exercising both the
	// "duplicate email" and "partial-failure rollback" requirements together.
	await signInAsOperator(page);
	await page.goto('/admin/clients/new', { waitUntil: 'networkidle' });

	const businessName = uniqueBusinessName();
	await page.getByLabel('Business name').fill(businessName);
	await page.getByLabel('Owner full name').fill('Existing Owner');
	await page.getByLabel('Owner email').fill(INVITER_EMAIL);
	await page.getByRole('button', { name: 'Create client' }).click();

	await expect(page.getByText('That email already has an account.')).toBeVisible();
	await expect(page).toHaveURL('/admin/clients/new');

	const admin = createAdminClient();
	const { data: org } = await admin
		.from('organizations')
		.select('id')
		.eq('name', businessName)
		.maybeSingle();
	expect(org).toBeNull();
});

test('an operator creates a client and the invited owner lands in their own, empty dashboard', async ({
	page,
	browser
}) => {
	await signInAsOperator(page);
	await page.goto('/admin/clients/new', { waitUntil: 'networkidle' });

	const businessName = uniqueBusinessName();
	const ownerEmail = uniqueOwnerEmail();
	await page.getByLabel('Business name').fill(businessName);
	await page.getByLabel('Owner full name').fill('New Owner');
	await page.getByLabel('Owner email').fill(ownerEmail);
	await page.getByRole('button', { name: 'Create client' }).click();

	await expect(page).toHaveURL('/admin');
	await expect(page.getByRole('cell', { name: businessName })).toBeVisible();
	await expect(page.getByText('Invited / pending setup')).toBeVisible();

	const emailBody = await getLatestEmailTo(ownerEmail);
	const confirmUrl = extractConfirmUrl(emailBody);

	const ownerContext = await browser.newContext();
	const ownerPage = await ownerContext.newPage();
	await ownerPage.goto(confirmUrl);
	await expect(ownerPage).toHaveURL('/set-password');

	await ownerPage.getByLabel('Password', { exact: true }).fill('a-fresh-password');
	await ownerPage.getByRole('button', { name: 'Set password' }).click();
	await expect(ownerPage).toHaveURL('/dashboard');

	// The new owner sees only their own (empty) org — no customers, no
	// catalog items, nothing carried over from the operator's or any other
	// client's data.
	await ownerPage.goto('/dashboard/customers');
	await expect(ownerPage.getByText('No customers found.')).toBeVisible();

	await ownerContext.close();

	await page.reload();
	await expect(page.getByText('Active').first()).toBeVisible();
});
