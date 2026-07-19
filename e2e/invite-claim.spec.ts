import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { extractConfirmUrl, getLatestEmailTo } from './mailpit';
import { INVITEE_EMAIL_PREFIX, INVITER_EMAIL, INVITER_PASSWORD } from './test-user';

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
