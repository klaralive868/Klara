/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: '127.0.0.1',
		port: 5183,
		strictPort: true,
		// No app code lives under supabase/ — but the CLI/Docker stack writes to
		// supabase/.temp during db reset/test runs, and watching that risked
		// spurious dev-server reloads aborting in-flight Playwright navigations.
		watch: { ignored: ['**/supabase/**'] }
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	],
	ssr: {
		// layerchart pulls in @dagrejs/dagre (used by chart types we don't render,
		// e.g. Sankey) whose "module" build has no .mjs extension or local
		// "type": "module" — left external, Vercel's Node runtime require()s it
		// as CJS and fails. Bundling it inline avoids that resolution entirely.
		noExternal: ['layerchart', '@dagrejs/dagre']
	},
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Integration tests hit a real local Supabase Postgres instance (see
		// vitest.integration.config.ts) — kept out of the default fake-client
		// suite so `npm run test:unit` stays fast and hermetic, same as every
		// other test in this repo today.
		exclude: ['e2e/**', 'src/**/*.integration.test.ts'],
		passWithNoTests: true
	}
});
