import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, rateLimitKey, resetRateLimits } from './rate-limit';

describe('checkRateLimit', () => {
	beforeEach(() => {
		resetRateLimits();
	});

	it('allows requests under the limit', () => {
		const opts = { limit: 3, windowMs: 60_000 };
		expect(checkRateLimit('key', opts, 0)).toBe(true);
		expect(checkRateLimit('key', opts, 0)).toBe(true);
		expect(checkRateLimit('key', opts, 0)).toBe(true);
	});

	it('rejects requests once the limit is exceeded within the window', () => {
		const opts = { limit: 3, windowMs: 60_000 };
		checkRateLimit('key', opts, 0);
		checkRateLimit('key', opts, 0);
		checkRateLimit('key', opts, 0);
		expect(checkRateLimit('key', opts, 0)).toBe(false);
	});

	it('resets the count once the window has elapsed', () => {
		const opts = { limit: 1, windowMs: 1_000 };
		expect(checkRateLimit('key', opts, 0)).toBe(true);
		expect(checkRateLimit('key', opts, 500)).toBe(false);
		expect(checkRateLimit('key', opts, 1_001)).toBe(true);
	});

	it('tracks separate keys independently', () => {
		const opts = { limit: 1, windowMs: 60_000 };
		expect(checkRateLimit('a', opts, 0)).toBe(true);
		expect(checkRateLimit('b', opts, 0)).toBe(true);
		expect(checkRateLimit('a', opts, 0)).toBe(false);
		expect(checkRateLimit('b', opts, 0)).toBe(false);
	});
});

describe('rateLimitKey', () => {
	it('composes a scope, ip, and email into one key', () => {
		expect(rateLimitKey('sign-in', '127.0.0.1', 'a@example.com')).toBe(
			'sign-in:127.0.0.1:a@example.com'
		);
	});

	it('keeps different scopes for the same ip/email separate', () => {
		expect(rateLimitKey('sign-in', '127.0.0.1', 'a@example.com')).not.toBe(
			rateLimitKey('claim', '127.0.0.1', 'a@example.com')
		);
	});
});
