import { expect, test } from '@playwright/test';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './test-user';

async function fillAndSubmitSignIn(
	page: import('@playwright/test').Page,
	email: string,
	password: string
) {
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
	await page.goto('/sign-in', { waitUntil: 'networkidle' });
	await fillAndSubmitSignIn(page, email, password);
}

test('anonymous visit to a protected route redirects to sign-in with redirectTo', async ({
	page
}) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL('/sign-in?redirectTo=%2Fdashboard');
});

test('signing in redirects to the requested page, then the session survives a hard refresh', async ({
	page
}) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL('/sign-in?redirectTo=%2Fdashboard');

	await fillAndSubmitSignIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);

	await expect(page).toHaveURL('/dashboard');

	await page.reload();
	await expect(page).toHaveURL('/dashboard');
});

test('signing in with no prior destination lands on the default dashboard', async ({ page }) => {
	await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
	await expect(page).toHaveURL('/dashboard');
});

test('an unknown email shows the generic error message', async ({ page }) => {
	await signIn(page, 'no-such-user@example.com', 'whatever-password');
	await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
	await expect(page).toHaveURL('/sign-in');
});

test('a wrong password for a real account shows the identical generic error message', async ({
	page
}) => {
	await signIn(page, TEST_USER_EMAIL, 'the-wrong-password');
	await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
	await expect(page).toHaveURL('/sign-in');
});

test('signing out clears the session and returns to sign-in on the next protected visit', async ({
	page
}) => {
	await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
	await expect(page).toHaveURL('/dashboard');
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: TEST_USER_EMAIL }).click();
	await page.getByRole('menuitem', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/sign-in');

	await page.goto('/dashboard');
	await expect(page).toHaveURL('/sign-in?redirectTo=%2Fdashboard');
});
