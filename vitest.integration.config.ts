// Integration tests hit a real local Supabase Postgres instance (docker
// compose, `npx supabase start`) — genuinely different from the fake-client
// unit suite (vite.config.ts's `test` block), which every other test in this
// repo uses. First test tier of this kind: kept in its own config/script
// (`npm run test:integration`) rather than folded into `npm run test:unit`,
// so the existing hermetic suite's contract with CI/contributors doesn't
// silently change to "requires local Supabase running."
//
// Plain object spread, not vitest's mergeConfig — mergeConfig concatenates
// array fields (include/exclude) rather than replacing them, which silently
// left this config still excluding *.integration.test.ts (inherited from
// the base config) while also including the base's own test glob, so it
// ran the whole unit suite and nothing new. Spreading `test` wholesale
// avoids that trap.
import { defineConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig({
	...baseConfig,
	test: {
		environment: 'node',
		include: ['src/**/*.integration.test.ts'],
		// Two genuinely concurrent Postgres round trips plus setup/teardown
		// per test — slower than the fake-client suite by design.
		testTimeout: 30_000
	}
});
