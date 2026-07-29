import type { SupabaseClient } from '@supabase/supabase-js';

export type MembershipStatus = 'active' | 'pending' | 'none';

// A user can hold at most one active membership (enforced by a partial unique
// index — see the organization_members migration), so "any active row" and
// "the" active membership are the same question.
//
// The joined organizations.status matters here, not just the membership
// row's own status: member_select_own_row (20260719054648) lets a caller
// see their own membership row regardless of current_organization_id()
// (which the deactivation gate — ADR-0009 — makes null once their org is
// archived), so an archived org's "active" member would otherwise still
// read as 'active' here and sail through the (protected) dashboard guard.
// organizations_select_via_own_membership (20260730020000) makes the
// joined org visible to check this.
interface MembershipRow {
	status: string;
	// organization_members.organization_id -> organizations.id is many-to-one,
	// so this embeds as a single object at runtime — supabase-js's untyped
	// (no generated Database schema) inference defaults it to an array
	// instead, hence the cast below.
	organizations: { status: string } | null;
}

export async function getMembershipStatus(
	supabase: SupabaseClient,
	userId: string
): Promise<MembershipStatus> {
	const { data, error } = await supabase
		.from('organization_members')
		.select('status, organizations(status)')
		.eq('user_id', userId);

	if (error || !data || data.length === 0) {
		return 'none';
	}

	const rows = data as unknown as MembershipRow[];

	if (rows.some((row) => row.status === 'active' && row.organizations?.status === 'active')) {
		return 'active';
	}

	if (rows.some((row) => row.status === 'pending')) {
		return 'pending';
	}

	return 'none';
}
