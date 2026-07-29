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
		//
		// Same story for enabledModules: RLS already scopes client_modules to
		// the caller's own organization, so this is just "which of my org's
		// rows exist," not an authorization check itself — each module's own
		// +layout.server.ts is the actual enforcement point (Standards §2:
		// display-only state never substitutes for a real server-side check).
		const [operatorStatus, modulesResult] = await Promise.all([
			isOperator(locals.supabase, user.id),
			locals.supabase.from('client_modules').select('module')
		]);
		const enabledModules = (modulesResult.data ?? []).map((row) => row.module);
		return { user, isOperator: operatorStatus, enabledModules };
	}

	// A pending member (mid invite-claim) is forced to set-password regardless
	// of what protected path they hit — there's nothing else for them to do yet.
	if (status === 'pending') {
		throw redirect(303, '/set-password');
	}

	throw redirect(303, signInTarget);
};
