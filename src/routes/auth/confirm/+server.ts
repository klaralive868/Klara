import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import { getMembershipStatus } from '$lib/server/membership';
import type { RequestHandler } from './$types';

const CLAIM_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

// Standard Supabase + SvelteKit invite/magic-link callback: exchanges the
// token_hash Supabase emailed the user for a session, then routes based on
// this app's own organization_members state (ADR-0002) — never by parsing
// Supabase's error content, since a used/expired token gives no way to tell
// "already claimed" apart from "genuinely invalid" without that state.
export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;

	// Keyed on IP alone, not the guessed token — there's no identity to scope by
	// before verification succeeds, and keying on the token would let an
	// attacker reset their own rate-limit budget by guessing a new token each
	// time, defeating the point of throttling this endpoint at all.
	const key = rateLimitKey('claim', getClientAddress(), 'attempt');
	if (!checkRateLimit(key, CLAIM_RATE_LIMIT)) {
		throw redirect(303, '/sign-in?notice=invalid-link');
	}

	if (!tokenHash || !type) {
		throw redirect(303, '/sign-in?notice=invalid-link');
	}

	const { error } = await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash });
	if (error) {
		// The token itself is single-use, so a second click always fails here —
		// that alone can't distinguish "already claimed" from "never valid".
		// Whether *this browser* happens to have an active session says nothing
		// about who this token belonged to — any signed-in active user (not
		// just the one who originally claimed this specific link) would satisfy
		// that check, so it can't be used to justify signing anyone out or
		// reporting "already claimed" here. Always read as invalid-link instead;
		// this is a known, accepted limit of a single-use token (documented in
		// klara-standards-v2.md §3).
		throw redirect(303, '/sign-in?notice=invalid-link');
	}

	const { user } = await locals.safeGetSession();
	if (!user) {
		throw redirect(303, '/sign-in?notice=invalid-link');
	}

	const status = await getMembershipStatus(locals.supabase, user.id);

	if (status === 'pending') {
		throw redirect(303, '/set-password');
	}

	// Already active (a previously-claimed link, re-visited), or no membership
	// row at all — neither has anything left to do here. Sign out so a stale
	// re-verified session doesn't linger, and send them to sign in properly.
	await locals.supabase.auth.signOut();
	throw redirect(
		303,
		`/sign-in?notice=${status === 'active' ? 'already-claimed' : 'invalid-link'}`
	);
};
