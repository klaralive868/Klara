import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Orders are a Catalog-domain concept (checkout against catalog items) —
// gated on the same 'catalog' module flag as /dashboard/catalog itself,
// same silent-redirect convention (see that route's own +layout.server.ts).
export const load: LayoutServerLoad = async ({ parent }) => {
	const { enabledModules } = await parent();
	if (!enabledModules.includes('catalog')) {
		throw redirect(303, '/dashboard');
	}
};
