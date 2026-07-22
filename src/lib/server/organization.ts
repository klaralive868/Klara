import type { SupabaseClient } from '@supabase/supabase-js';

// Storage object paths embed organization_id explicitly ({organization_id}/
// {item_id}/{image_id}.{ext}) — RLS can't infer it the way it does for a
// table column, so the caller's active org has to be looked up directly.
//
// A partial unique index (organization_members_one_active_per_user, see the
// organization_members migration) enforces at most one active membership
// per user at the DB level, so this should only ever match one row. Even
// so, this deliberately doesn't use .maybeSingle() — the Supabase client
// treats more than one matching row as an error there, not a silent pick,
// and current_organization_id() itself resolves the same ambiguity by
// ordering and taking the most recently claimed row. Mirroring that here
// means a user somehow left with more than one active row (e.g. a future
// bug, or the invariant being relaxed) degrades gracefully to "use their
// most recent org" instead of failing every image upload outright.
export async function getActiveOrganizationId(
	supabase: SupabaseClient,
	userId: string
): Promise<string | null> {
	const { data, error } = await supabase
		.from('organization_members')
		.select('organization_id')
		.eq('user_id', userId)
		.eq('status', 'active')
		.order('claimed_at', { ascending: false })
		.limit(1);

	if (error || !data || data.length === 0) {
		return null;
	}

	return data[0].organization_id;
}
