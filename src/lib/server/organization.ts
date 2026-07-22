import type { SupabaseClient } from '@supabase/supabase-js';

// Storage object paths embed organization_id explicitly ({organization_id}/
// {item_id}/{image_id}.{ext}) — RLS can't infer it the way it does for a
// table column, so the caller's active org has to be looked up directly.
export async function getActiveOrganizationId(
	supabase: SupabaseClient,
	userId: string
): Promise<string | null> {
	const { data, error } = await supabase
		.from('organization_members')
		.select('organization_id')
		.eq('user_id', userId)
		.eq('status', 'active')
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	return data.organization_id;
}
