import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Klara has no public marketing/landing page (Architecture Brief §3) — the
// sign-in page is the correct thing at root. A permanent, server-side
// redirect resolves before any content renders, unlike a client-side one.
export const load: PageServerLoad = () => {
	redirect(308, '/sign-in');
};
