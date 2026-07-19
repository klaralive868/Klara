import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	const signInTarget = `/sign-in?redirectTo=${encodeURIComponent(url.pathname + url.search)}`;

	if (!session || !user) {
		throw redirect(303, signInTarget);
	}

	// Any failure here (no active membership — e.g. still pending an invite claim)
	// is treated the same as no session for now. Ticket #4 introduces a dedicated
	// pending -> set-password redirect once that route exists.
	const { data: organizationId, error } = await locals.supabase.rpc('current_organization_id');
	if (error || !organizationId) {
		throw redirect(303, signInTarget);
	}

	return { user };
};
