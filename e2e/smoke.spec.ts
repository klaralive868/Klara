import { expect, test } from '@playwright/test';

test('the app boots and serves the scaffold page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL('/');
});
