import { redirect } from '@sveltejs/kit';
import { getMembershipStatus } from '$lib/server/membership';
import { isOperator } from '$lib/server/operator';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	const signInTarget = `/sign-in?redirectTo=${encodeURIComponent(url.pathname + url.search)}`;

	if (!session || !user) {
		throw redirect(303, signInTarget);
	}

	const status = await getMembershipStatus(locals.supabase, user.id);

	if (status === 'active') {
		// Drives whether the sidebar shows the "Admin" option — the (admin)
		// guard is the actual enforcement point, this is display-only. Loaded
		// here (not per-page) so every sidebar-shell page under (protected)
		// gets it for free instead of re-querying it individually.
		return { user, isOperator: await isOperator(locals.supabase, user.id) };
	}

	// A pending member (mid invite-claim) is forced to set-password regardless
	// of what protected path they hit — there's nothing else for them to do yet.
	if (status === 'pending') {
		throw redirect(303, '/set-password');
	}

	throw redirect(303, signInTarget);
};
