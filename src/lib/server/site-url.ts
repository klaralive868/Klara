import { env } from '$env/dynamic/public';

// The canonical origin every invite/confirm/reset link must point to —
// deliberately never derived from the triggering request's own `url.origin`.
// A request can legitimately arrive on a Vercel preview alias (or any other
// non-canonical host) while still being a real, authorized action; baking
// that host into an emailed link makes the link permanently point at a
// deployment that may not exist by the time the recipient clicks it. This
// is set once per environment (Vercel project env vars / local .env), not
// read off the request.
//
// $env/dynamic/public (not .../static/public) deliberately: a missing var
// here should fail loudly at the one call site that needs it (below), not
// break every route's build if a deploy environment hasn't set it yet.
function requireSiteUrl(): string {
	const value = env.PUBLIC_SITE_URL;
	if (!value) {
		throw new Error(
			'PUBLIC_SITE_URL is not set — cannot build an auth link without a canonical origin ' +
				'(Standards §8: fail loudly rather than silently falling back to the request origin).'
		);
	}
	return value.replace(/\/$/, '');
}

export const SITE_URL = requireSiteUrl();
