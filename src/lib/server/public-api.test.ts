import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './public-api';
import type { PublicOrganization } from './public-organization';

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
		expect(isOriginAllowed(org(['https://worldview.example']), 'https://evil.example')).toBe(
			false
		);
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
