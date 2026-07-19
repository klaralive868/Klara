interface RateLimitOptions {
	limit: number;
	windowMs: number;
}

interface Bucket {
	count: number;
	resetAt: number;
}

// In-memory, per-server-instance only — resets on deploy/restart and isn't shared
// across instances. Fine for now; revisit with a shared store (Redis/Upstash) if
// the app ever runs more than one instance.
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, options: RateLimitOptions, now = Date.now()): boolean {
	const bucket = buckets.get(key);

	if (!bucket || now >= bucket.resetAt) {
		buckets.set(key, { count: 1, resetAt: now + options.windowMs });
		return true;
	}

	if (bucket.count >= options.limit) {
		return false;
	}

	bucket.count += 1;
	return true;
}

export function resetRateLimits() {
	buckets.clear();
}

// Shared key shape for every rate-limited endpoint (sign-in, and eventually
// claim/set-password) so call sites don't each compose their own string.
export function rateLimitKey(scope: string, ip: string, email: string): string {
	return `${scope}:${ip}:${email}`;
}
