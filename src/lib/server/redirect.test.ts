import { describe, expect, it } from 'vitest';
import { validateRedirectTo } from './redirect';

describe('validateRedirectTo', () => {
	it('accepts a same-origin root-relative path', () => {
		expect(validateRedirectTo('/clients/42')).toBe('/clients/42');
	});

	it('accepts a same-origin path with a query string', () => {
		expect(validateRedirectTo('/clients/42?tab=notes')).toBe('/clients/42?tab=notes');
	});

	it('rejects null', () => {
		expect(validateRedirectTo(null)).toBeNull();
	});

	it('rejects an empty string', () => {
		expect(validateRedirectTo('')).toBeNull();
	});

	it('rejects a path that does not start with a slash', () => {
		expect(validateRedirectTo('dashboard')).toBeNull();
	});

	it('rejects an absolute external URL', () => {
		expect(validateRedirectTo('https://evil.com/phish')).toBeNull();
	});

	it('rejects a protocol-relative URL', () => {
		expect(validateRedirectTo('//evil.com')).toBeNull();
	});

	it('rejects a backslash-prefixed path (browsers can normalize \\ to /)', () => {
		expect(validateRedirectTo('/\\evil.com')).toBeNull();
	});

	it('accepts a same-origin path whose query string happens to contain a URL', () => {
		// The browser only ever navigates to this literal path — the query string
		// content is inert data, not something to be reinterpreted as a target.
		expect(validateRedirectTo('/redirect?to=https://evil.com')).toBe(
			'/redirect?to=https://evil.com'
		);
	});
});
