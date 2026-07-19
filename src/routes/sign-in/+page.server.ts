import { fail, redirect } from '@sveltejs/kit';
import { validateRedirectTo } from '$lib/server/redirect';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import type { Actions } from './$types';

const SIGN_IN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const GENERIC_ERROR = 'Invalid email or password.';
const RATE_LIMITED_ERROR = 'Too many attempts. Please try again later.';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '');
		const password = String(formData.get('password') ?? '');
		const redirectTo = validateRedirectTo(url.searchParams.get('redirectTo'));

		const key = rateLimitKey('sign-in', getClientAddress(), email);
		if (!checkRateLimit(key, SIGN_IN_RATE_LIMIT)) {
			return fail(429, { message: RATE_LIMITED_ERROR });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { message: GENERIC_ERROR });
		}

		throw redirect(303, redirectTo ?? '/dashboard');
	}
};
