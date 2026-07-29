import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getOrganizationBySlug, type PublicOrganization } from '$lib/server/public-organization';

const CORS_ALLOWED_HEADERS = 'Content-Type';
const CORS_MAX_AGE = '86400';

interface JsonResponseInit {
	status?: number;
	origin?: string;
}

// Access-Control-Allow-Origin is only ever set to the caller's own,
// already-validated origin (never '*') — callers only pass `origin` once
// isOriginAllowed has approved it, so echoing it back doesn't widen access.
// Vary: Origin tells any intermediate cache this response differs per
// requesting origin, so one org's cached response can't be served to a
// different, disallowed origin.
function withOptionalCors(response: Response, origin?: string): Response {
	if (origin) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Vary', 'Origin');
	}
	return response;
}

export function jsonOk(data: unknown, init: JsonResponseInit = {}): Response {
	return withOptionalCors(json({ data }, { status: init.status ?? 200 }), init.origin);
}

export function jsonError(status: number, message: string, init: JsonResponseInit = {}): Response {
	return withOptionalCors(json({ error: { message } }, { status }), init.origin);
}

// Fail-closed (ADR-0008 / Standards §12): an org with a null/empty
// allowed_origins, or a request with no Origin header at all, is rejected
// the same as an origin that's simply not on the list. There's no reading
// of an unset allowlist as "allow everything" — a missing Origin header
// isn't a same-origin signal here, since every caller of this API surface
// is by definition an *external* site, never Klara's own pages.
export function isOriginAllowed(organization: PublicOrganization, origin: string | null): boolean {
	if (!origin) {
		return false;
	}
	return organization.allowedOrigins.includes(origin);
}

export interface PublicApiContext {
	organization: PublicOrganization;
	origin: string;
	admin: ReturnType<typeof createSupabaseAdminClient>;
}

type PublicApiResult = { ok: true; context: PublicApiContext } | { ok: false; response: Response };

// Shared entry sequence for every module's public API endpoint (ADR-0008):
// resolve the organization from the URL slug (never a client-supplied org
// id), then check the request's Origin header against that org's
// allowed_origins. Deliberately stops here — body-parsing and
// rate-limiting stay in each endpoint, since rate-limit bucket keys depend
// on the parsed body (e.g. email) and differ per operation, so there's
// nothing generic left for this wrapper to own past this point.
export async function resolvePublicApiRequest(event: RequestEvent): Promise<PublicApiResult> {
	const origin = event.request.headers.get('origin');
	const admin = createSupabaseAdminClient();
	const orgSlug = event.params.orgSlug ?? '';
	const organization = await getOrganizationBySlug(admin, orgSlug);

	if (!organization) {
		return { ok: false, response: jsonError(404, 'Not found') };
	}

	if (!isOriginAllowed(organization, origin)) {
		// No Access-Control-Allow-Origin header on this response is
		// deliberate: a disallowed/absent origin gets no CORS grant, so a
		// browser blocks the caller from reading the body regardless of
		// this 403's own content.
		return { ok: false, response: jsonError(403, 'Origin not allowed') };
	}

	return { ok: true, context: { organization, origin: origin as string, admin } };
}

// A CORS preflight only needs to know whether the requesting origin is
// allowed, not anything about the specific operation — but the advertised
// Allow-Methods does need to match what the route actually exports (a
// GET-only route falsely advertising POST as allowed is misleading, even
// though nothing else here enforces it). Each route supplies its own
// methods list and assigns the result as its `OPTIONS` export.
export function createPreflightHandler(
	methods: string
): (event: RequestEvent) => Promise<Response> {
	return async (event) => {
		const result = await resolvePublicApiRequest(event);
		if (!result.ok) {
			return result.response;
		}

		return withOptionalCors(
			new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Methods': methods,
					'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
					'Access-Control-Max-Age': CORS_MAX_AGE
				}
			}),
			result.context.origin
		);
	};
}

type JsonBodyResult =
	{ ok: true; value: Record<string, unknown> } | { ok: false; response: Response };

// Shared by every write endpoint (ADR-0008 / Standards §12: no duplicated
// logic between entry points applies within this API surface too, not just
// against the page actions) — a malformed JSON body gets the same 400
// response shape regardless of which endpoint received it.
export async function parseJsonBody(event: RequestEvent, origin: string): Promise<JsonBodyResult> {
	let value: unknown;
	try {
		value = await event.request.json();
	} catch {
		return { ok: false, response: jsonError(400, 'Request body must be valid JSON.', { origin }) };
	}

	// request.json() succeeds on any valid JSON document, not just objects —
	// `null`, `"a string"`, `42`, and `[1,2]` all parse without throwing. Each
	// field parser downstream immediately indexes into the body as a record,
	// so anything that isn't a plain object needs to be rejected here rather
	// than reaching them as an uncaught TypeError.
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return {
			ok: false,
			response: jsonError(400, 'Request body must be a JSON object.', { origin })
		};
	}

	return { ok: true, value: value as Record<string, unknown> };
}
