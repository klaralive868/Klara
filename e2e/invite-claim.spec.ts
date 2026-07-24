import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { createAdminClient } from './admin-client';
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
	await page.goto('/dashboard/team');
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

test('submitting set-password with a password that already matches succeeds instead of erroring', async ({
	page,
	browser
}) => {
	// Regression test for: if the membership-activation write ever fails after
	// the password was already changed, the invitee is left pending with a
	// password that no longer matches what they originally typed. A retry
	// with that same (now-current) password must succeed, not be rejected as
	// "must differ from the old password" — which would strand them
	// permanently. Simulated here by setting the password out-of-band to the
	// value the invitee is about to (re)submit, standing in for "a prior
	// attempt already got this far."
	const email = uniqueInviteeEmail();

	await signInAsInviter(page);
	await sendInvite(page, email);

	const { inviteeContext, inviteePage } = await claimInviteInNewContext(browser, email);
	await expect(inviteePage).toHaveURL('/set-password');

	const admin = createAdminClient();
	const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
	const invitee = usersPage?.users.find((candidate) => candidate.email === email);
	if (!invitee) throw new Error(`e2e setup failure: invitee ${email} not found`);
	await admin.auth.admin.updateUserById(invitee.id, { password: 'retry-password' });

	// The out-of-band update above invalidates the session from claiming the
	// link, exactly as it would after the app's own re-sign-in step inside a
	// request that failed later at the membership write — sign back in to
	// reach the same starting point a real retry would.
	await inviteePage.goto('/sign-in');
	await inviteePage.getByLabel('Email').fill(email);
	await inviteePage.getByLabel('Password', { exact: true }).fill('retry-password');
	await inviteePage.getByRole('button', { name: 'Sign in' }).click();
	await expect(inviteePage).toHaveURL('/set-password');

	await inviteePage.getByLabel('Password', { exact: true }).fill('retry-password');
	await inviteePage.getByRole('button', { name: 'Set password' }).click();

	await expect(inviteePage).toHaveURL('/dashboard');

	await inviteeContext.close();
});

test('revisiting a claimed invite link shows invalid-link and does not sign the user out', async ({
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

	// The token is single-use, so a second visit always fails verification —
	// there's no reliable way to tell "already claimed" apart from "never
	// valid" from that failure alone (an earlier attempt that tried to infer
	// it from "does this browser have an active session" incorrectly signed
	// out and misinformed unrelated active users; see klara-standards-v2.md
	// §3). Both cases now read as invalid-link, and — the important part —
	// visiting this dead link must not disturb the still-active session at
	// all.
	await inviteePage.goto(confirmUrl);

	await expect(inviteePage).toHaveURL('/sign-in?notice=invalid-link');
	await expect(inviteePage.getByRole('status')).toHaveText(
		'This invite link is invalid or has expired.'
	);

	// The invitee's own session must still be intact — confirm() didn't sign
	// them out as a side effect of the failed verification.
	await inviteePage.goto('/dashboard');
	await expect(inviteePage).toHaveURL('/dashboard');

	await inviteeContext.close();
});

test('a genuinely invalid or expired invite link shows a distinct notice', async ({ page }) => {
	await page.goto('/auth/confirm?token_hash=not-a-real-token&type=invite');

	await expect(page).toHaveURL('/sign-in?notice=invalid-link');
	await expect(page.getByRole('status')).toHaveText('This invite link is invalid or has expired.');
});

test('an unrelated active user hitting a broken invite link keeps their own session', async ({
	page
}) => {
	// Regression test: an earlier version inferred "already claimed" from
	// "does this browser currently have an active session" — which is true
	// for ANY signed-in active user, not just the one who owns this specific
	// token. That incorrectly signed out and misinformed someone like an
	// owner testing a stale invite link while signed into their own account.
	// Signed in as the manager (not the inviter) purely to keep this test's
	// sign-in off the inviter's rate-limit budget, shared across this file.
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(MANAGER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

	await page.goto('/auth/confirm?token_hash=not-a-real-token&type=invite');
	await expect(page).toHaveURL('/sign-in?notice=invalid-link');

	// Their own, entirely unrelated session must still be intact.
	await page.goto('/dashboard');
	await expect(page).toHaveURL('/dashboard');
});

test('a manager cannot invite someone as owner', async ({ page }) => {
	const email = uniqueInviteeEmail();

	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(MANAGER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
	await page.goto('/dashboard/team');

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
	// actual attack surface, not just a UI-level check. Signed in as the
	// manager purely to keep this test's two sign-ins off the inviter's
	// rate-limit budget, shared across this file.
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(MANAGER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

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
	await page.getByLabel('Email').fill(MANAGER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');
});
