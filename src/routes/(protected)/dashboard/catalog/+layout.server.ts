import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Mirrors the (admin) layout's silent-redirect convention: an org without
// the 'catalog' module gets bounced to /dashboard rather than a 404 or an
// "access denied" state, since confirming/denying this route tree's
// existence to them is the same disclosure Standards' auth-error guidance
// warns against for (admin). The (protected) layout already fetched
// enabledModules via RLS-scoped client_modules; this just reads it.
export const load: LayoutServerLoad = async ({ parent }) => {
	const { enabledModules } = await parent();
	if (!enabledModules.includes('catalog')) {
		throw redirect(303, '/dashboard');
	}
};
