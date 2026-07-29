import { describe, expect, it } from 'vitest';
import { isOriginAllowed, parseJsonBody } from './public-api';
import type { PublicOrganization } from './public-organization';
import type { RequestEvent } from '@sveltejs/kit';

function org(allowedOrigins: string[]): PublicOrganization {
	return { id: 'org-1', slug: 'worldview', allowedOrigins };
}

describe('isOriginAllowed', () => {
	it('allows an origin on the allowlist', () => {
		expect(isOriginAllowed(org(['https://worldview.example']), 'https://worldview.example')).toBe(
			true
		);
	});

	it('rejects an origin not on the allowlist', () => {
		expect(isOriginAllowed(org(['https://worldview.example']), 'https://evil.example')).toBe(false);
	});

	it('rejects when allowed_origins is empty', () => {
		expect(isOriginAllowed(org([]), 'https://worldview.example')).toBe(false);
	});

	// allowed_origins is nullable in the DB; getOrganizationBySlug already
	// normalizes null to [] before this function ever sees it, but this
	// guards the fail-closed contract directly rather than only through
	// that normalization.
	it('rejects a request with no Origin header at all', () => {
		expect(isOriginAllowed(org(['https://worldview.example']), null)).toBe(false);
	});

	it('is case-sensitive and exact-match, not a prefix/substring match', () => {
		expect(
			isOriginAllowed(org(['https://worldview.example']), 'https://worldview.example.evil.com')
		).toBe(false);
	});
});

function eventWithBody(body: string): RequestEvent {
	return {
		request: new Request('https://klara.live/api/v1/bookings/worldview/inquiries', {
			method: 'POST',
			body
		})
	} as RequestEvent;
}

describe('parseJsonBody', () => {
	it('accepts a JSON object body', async () => {
		const result = await parseJsonBody(
			eventWithBody('{"name":"Jane"}'),
			'https://worldview.example'
		);
		expect(result).toEqual({ ok: true, value: { name: 'Jane' } });
	});

	// request.json() resolves successfully for any valid JSON document, not
	// just objects — null/arrays/primitives would otherwise reach a field
	// parser downstream that immediately indexes into the value as a record,
	// causing an uncaught TypeError instead of a structured 400.
	it('rejects a JSON null body', async () => {
		const result = await parseJsonBody(eventWithBody('null'), 'https://worldview.example');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
		}
	});

	it('rejects a JSON array body', async () => {
		const result = await parseJsonBody(eventWithBody('[1,2,3]'), 'https://worldview.example');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
		}
	});

	it('rejects a JSON primitive body', async () => {
		const result = await parseJsonBody(
			eventWithBody('"just a string"'),
			'https://worldview.example'
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
		}
	});

	it('rejects malformed JSON', async () => {
		const result = await parseJsonBody(eventWithBody('{not json'), 'https://worldview.example');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
		}
	});
});
