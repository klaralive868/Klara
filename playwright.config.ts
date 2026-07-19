import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Tests hit a real local Supabase stack (Postgres + GoTrue in Docker), not a
	// mock — 4+ parallel workers reliably starved it under load and produced
	// spurious timeouts. 2 keeps a bit of parallelism without that contention.
	workers: 2,
	// Default 30s was occasionally too tight on this dev machine (Vite +
	// Dockerized Supabase competing for CPU during a cold route compile),
	// producing spurious full-timeout failures unrelated to app behavior.
	timeout: 60_000,
	reporter: 'html',
	use: {
		baseURL: 'http://127.0.0.1:5183',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run dev',
		url: 'http://127.0.0.1:5183',
		reuseExistingServer: !process.env.CI
	}
});
