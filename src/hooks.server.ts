import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		// Re-validates the JWT against Supabase Auth rather than trusting the cookie-derived session.
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}

		// session.user is cookie-derived and unvalidated — strip it so callers can't
		// reach it in place of the getUser()-validated `user` above.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { user: _unvalidatedUser, ...safeSession } = session;
		return { session: safeSession, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
