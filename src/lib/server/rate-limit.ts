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

// Swept on every call so the map never accumulates keys past their window —
// otherwise an attacker probing distinct emails/IPs grows it unboundedly.
function evictExpired(now: number) {
	for (const [key, bucket] of buckets) {
		if (now >= bucket.resetAt) {
			buckets.delete(key);
		}
	}
}

export function checkRateLimit(key: string, options: RateLimitOptions, now = Date.now()): boolean {
	evictExpired(now);

	const bucket = buckets.get(key);

	if (!bucket) {
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

export function rateLimitBucketCount() {
	return buckets.size;
}

// Shared key shape for every rate-limited endpoint (sign-in, and eventually
// claim/set-password) so call sites don't each compose their own string.
// Delimited with | rather than : — IPv6 addresses (e.g. ::1) contain colons,
// which would make a colon-delimited key ambiguous to split back apart.
export function rateLimitKey(scope: string, ip: string, email: string): string {
	return `${scope}|${ip}|${email}`;
}
