// Only accepts a root-relative, same-origin path — anything else (absolute URLs,
// protocol-relative //host, or a backslash a browser might normalize to //) is
// rejected outright to prevent it being used as an open redirect.
export function validateRedirectTo(candidate: string | null | undefined): string | null {
	if (!candidate) return null;
	if (!candidate.startsWith('/')) return null;
	if (candidate.startsWith('//')) return null;
	if (candidate.startsWith('/\\')) return null;
	return candidate;
}
