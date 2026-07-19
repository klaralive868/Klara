import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { extractConfirmUrl, getLatestEmailTo } from './mailpit';
import {
	INVITEE_EMAIL_PREFIX,
	INVITER_EMAIL,
	INVITER_PASSWORD,
	MANAGER_EMAIL,
	MANAGER_PASSWORD
} from './test-user';

function uniqueInviteeEmail() {
	return `${INVITEE_EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signInAsInviter(page: Page) {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(INVITER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(INVITER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
}

async function sendInvite(page: Page, email: string) {
	// No inbox cleanup here — each invitee email is unique per test, and
	// getLatestEmailTo filters by that exact address, so tests stay isolated
	// from each other without needing to (destructively) clear Mailpit's
	// shared inbox, which would race against a parallel test's own email.
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Role').selectOption('staff');
	await page.getByRole('button', { name: 'Send invite' }).click();
	await expect(page.getByRole('status')).toHaveText(`Invite sent to ${email}.`);
}

async function claimInviteInNewContext(browser: Browser, email: string) {
	const emailBody = await getLatestEmailTo(email);
	const confirmUrl = extractConfirmUrl(emailBody);

	const inviteeContext = await browser.newContext();
	const inviteePage = await inviteeContext.newPage();
	await inviteePage.goto(confirmUrl);

	return { inviteeContext, inviteePage, confirmUrl };
}

test('full invite, claim, and set-password flow lands the invitee in the app', async ({
	page,
	browser
}) => {
	const email = uniqueInviteeEmail();

	await signInAsInviter(page);
	await sendInvite(page, email);

	const { inviteeContext, inviteePage } = await claimInviteInNewContext(browser, email);

	await expect(inviteePage).toHaveURL('/set-password');

	await inviteePage.getByLabel('Password', { exact: true }).fill('a-fresh-password');
	await inviteePage.getByRole('button', { name: 'Set password' }).click();

	await expect(inviteePage).toHaveURL('/dashboard');

	await inviteeContext.close();
});

test('revisiting an already-claimed invite link shows the already-claimed notice', async ({
	page,
	browser
}) => {
	const email = uniqueInviteeEmail();

	await signInAsInviter(page);
	await sendInvite(page, email);

	const { inviteeContext, inviteePage, confirmUrl } = await claimInviteInNewContext(browser, email);
	await expect(inviteePage).toHaveURL('/set-password');
	await inviteePage.getByLabel('Password', { exact: true }).fill('a-fresh-password');
	await inviteePage.getByRole('button', { name: 'Set password' }).click();
	await expect(inviteePage).toHaveURL('/dashboard');

	// Revisit the same link in the same browser session that originally
	// claimed it — the token itself is single-use and always fails on a
	// second visit, so distinguishing "already claimed" from "invalid" relies
	// on this browser still carrying the session from the original claim.
	await inviteePage.goto(confirmUrl);

	await expect(inviteePage).toHaveURL('/sign-in?notice=already-claimed');
	await expect(inviteePage.getByRole('status')).toHaveText(
		'This invite has already been claimed. Please sign in.'
	);

	await inviteeContext.close();
});

test('a genuinely invalid or expired invite link shows a distinct notice', async ({ page }) => {
	await page.goto('/auth/confirm?token_hash=not-a-real-token&type=invite');

	await expect(page).toHaveURL('/sign-in?notice=invalid-link');
	await expect(page.getByRole('status')).toHaveText('This invite link is invalid or has expired.');
});

test('a manager cannot invite someone as owner', async ({ page }) => {
	const email = uniqueInviteeEmail();

	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(MANAGER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Role').selectOption('owner');
	await page.getByRole('button', { name: 'Send invite' }).click();

	await expect(page.getByRole('alert')).toHaveText('managers cannot invite owners.');
});

test('an already-active user cannot change their password by posting directly to /set-password', async ({
	page
}) => {
	// Simulates POSTing the action directly (bypassing the UI and the `load`
	// guard that would normally redirect an active user away) — form actions
	// are dispatched independently of `load` in SvelteKit, so this is the
	// actual attack surface, not just a UI-level check.
	await signInAsInviter(page);

	// Posted via fetch() inside the actual browser page (not page.request) so
	// the real session cookie — Secure-flagged — is attached the way a
	// browser genuinely would; page.request is a separate HTTP client that
	// doesn't apply Chromium's "127.0.0.1 counts as secure" exception, and
	// silently drops Secure cookies on a plain-http request.
	const body = await page.evaluate(async () => {
		const res = await fetch('/set-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ password: 'attacker-chosen-password' })
		});
		return res.json();
	});
	// SvelteKit's fetch-style action response always transports as HTTP 200 —
	// the real outcome is the `status` field inside its JSON envelope.
	expect(body).toMatchObject({ type: 'failure', status: 403 });

	// Behavioral proof, not just the status code: the original password still
	// works, so nothing was actually changed.
	await page.context().clearCookies();
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(INVITER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(INVITER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
});
