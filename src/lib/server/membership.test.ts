import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMembershipStatus } from './membership';

function fakeSupabase(
	rows: Array<{ status: string; organizations: { status: string } | null }>
): SupabaseClient {
	return {
		from: () => ({
			select: () => ({
				eq: async () => ({ data: rows, error: null })
			})
		})
	} as unknown as SupabaseClient;
}

describe('getMembershipStatus', () => {
	it('is active for an active membership in an active organization', async () => {
		const supabase = fakeSupabase([{ status: 'active', organizations: { status: 'active' } }]);
		expect(await getMembershipStatus(supabase, 'user-1')).toBe('active');
	});

	// Regression test: member_select_own_row lets a caller see their own
	// membership row regardless of current_organization_id() (which the
	// org-deactivation gate makes null once their org is archived) — so an
	// archived org's "active" member must not read as 'active' here, or
	// they'd sail straight through the (protected) dashboard guard.
	it('is not active when the membership is active but the organization is archived', async () => {
		const supabase = fakeSupabase([{ status: 'active', organizations: { status: 'archived' } }]);
		expect(await getMembershipStatus(supabase, 'user-1')).toBe('none');
	});

	it('is pending for a pending membership, regardless of organization status', async () => {
		const supabase = fakeSupabase([{ status: 'pending', organizations: { status: 'active' } }]);
		expect(await getMembershipStatus(supabase, 'user-1')).toBe('pending');
	});

	it('is none when no membership rows exist', async () => {
		const supabase = fakeSupabase([]);
		expect(await getMembershipStatus(supabase, 'user-1')).toBe('none');
	});
});
