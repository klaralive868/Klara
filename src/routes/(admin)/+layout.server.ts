import { redirect } from '@sveltejs/kit';
import { isOperator } from '$lib/server/operator';
import type { LayoutServerLoad } from './$types';

// Independent of the (protected) guard — checks operators directly, per
// ADR-0003. Runs in addition to it, not instead of it: a route in both
// groups would need to satisfy both, though today (admin) routes don't
// nest under (protected).
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}

	// A non-operator gets silently redirected — no error, no "access denied"
	// state, since confirming/denying the admin area's existence to them is
	// exactly the kind of unnecessary disclosure Standards' auth-error
	// guidance warns against.
	if (!(await isOperator(locals.supabase, user.id))) {
		throw redirect(303, '/dashboard');
	}

	return { user };
};
