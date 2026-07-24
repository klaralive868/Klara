import { expect, test } from '@playwright/test';
import { INVITER_EMAIL, INVITER_PASSWORD, OPERATOR_EMAIL, OPERATOR_PASSWORD } from './test-user';

test('an operator sees the Admin option and reaches /admin via it', async ({ page }) => {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(OPERATOR_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(OPERATOR_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

	await page.getByRole('link', { name: 'Admin' }).click();

	await expect(page).toHaveURL('/admin');
	await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});

test('a non-operator does not see the Admin option, and is silently redirected if they visit /admin directly', async ({
	page
}) => {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(INVITER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(INVITER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/dashboard');

	await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

	await page.goto('/admin');
	await expect(page).toHaveURL('/dashboard');
});
