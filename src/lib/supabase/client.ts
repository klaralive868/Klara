import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

let browserClient: SupabaseClient | undefined;

// Memoized: createBrowserClient() runs its own token-refresh loop, so multiple
// instances on one page would refresh independently and race each other.
export function createSupabaseBrowserClient() {
	browserClient ??= createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	return browserClient;
}
