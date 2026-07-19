import { redirect } from '@sveltejs/kit';
import { getMembershipStatus } from '$lib/server/membership';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	const signInTarget = `/sign-in?redirectTo=${encodeURIComponent(url.pathname + url.search)}`;

	if (!session || !user) {
		throw redirect(303, signInTarget);
	}

	const status = await getMembershipStatus(locals.supabase, user.id);

	if (status === 'active') {
		return { user };
	}

	// A pending member (mid invite-claim) is forced to set-password regardless
	// of what protected path they hit — there's nothing else for them to do yet.
	if (status === 'pending') {
		throw redirect(303, '/set-password');
	}

	throw redirect(303, signInTarget);
};
