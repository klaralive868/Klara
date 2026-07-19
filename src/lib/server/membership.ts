import type { SupabaseClient } from '@supabase/supabase-js';

export type MembershipStatus = 'active' | 'pending' | 'none';

// A user can hold at most one active membership (enforced by a partial unique
// index — see the organization_members migration), so "any active row" and
// "the" active membership are the same question.
export async function getMembershipStatus(
	supabase: SupabaseClient,
	userId: string
): Promise<MembershipStatus> {
	const { data, error } = await supabase
		.from('organization_members')
		.select('status')
		.eq('user_id', userId);

	if (error || !data || data.length === 0) {
		return 'none';
	}

	if (data.some((row) => row.status === 'active')) {
		return 'active';
	}

	if (data.some((row) => row.status === 'pending')) {
		return 'pending';
	}

	return 'none';
}
