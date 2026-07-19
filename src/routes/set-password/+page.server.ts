import { fail, redirect } from '@sveltejs/kit';
import { getMembershipStatus } from '$lib/server/membership';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const SET_PASSWORD_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const status = await getMembershipStatus(locals.supabase, user.id);
	if (status === 'active') {
		throw redirect(303, '/dashboard');
	}
	if (status === 'none') {
		throw redirect(303, '/sign-in');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			throw redirect(303, '/sign-in');
		}

		// Actions are dispatched independently of `load` — POSTing here directly
		// would otherwise skip the pending-only guard `load` enforces, letting any
		// already-active, authenticated user change their password with no old-
		// password check at all.
		const status = await getMembershipStatus(locals.supabase, user.id);
		if (status !== 'pending') {
			return fail(403, { message: 'This action is not available.' });
		}

		const key = rateLimitKey('set-password', getClientAddress(), user.id);
		if (!checkRateLimit(key, SET_PASSWORD_RATE_LIMIT)) {
			return fail(429, { message: 'Too many attempts. Please try again later.' });
		}

		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');

		// Minimum length is enforced by Supabase project config (minimum_password_length),
		// so this call is the single source of truth — no duplicate check here.
		const { error: updateError } = await locals.supabase.auth.updateUser({ password });
		if (updateError) {
			return fail(400, { message: updateError.message });
		}

		const admin = createSupabaseAdminClient();
		const { error: memberError } = await admin
			.from('organization_members')
			.update({ status: 'active', claimed_at: new Date().toISOString() })
			.eq('user_id', user.id)
			.eq('status', 'pending');
		if (memberError) {
			return fail(500, { message: 'Password set, but failed to activate membership.' });
		}

		throw redirect(303, '/dashboard');
	}
};
