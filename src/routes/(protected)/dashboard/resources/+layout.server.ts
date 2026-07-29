import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// See dashboard/catalog/+layout.server.ts for the rationale behind this
// pattern (mirrors the (admin) layout's silent-redirect convention).
export const load: LayoutServerLoad = async ({ parent }) => {
	const { enabledModules } = await parent();
	if (!enabledModules.includes('resources')) {
		throw redirect(303, '/dashboard');
	}
};
