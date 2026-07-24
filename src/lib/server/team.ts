import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabase-admin';

export type TeamMember = {
	id: string;
	email: string;
	role: 'owner' | 'manager' | 'staff';
	status: 'pending' | 'active';
};

// organization_members carries no email column (RLS scopes it to the
// caller's own org via current_organization_id(), so the member rows
// themselves are safe to read with the caller's own client) — email lives on
// auth.users, only reachable through the admin client.
export async function listOrganizationMembers(
	supabase: SupabaseClient,
	organizationId: string
): Promise<TeamMember[]> {
	const { data, error } = await supabase
		.from('organization_members')
		.select('user_id, role, status')
		.eq('organization_id', organizationId)
		.order('created_at', { ascending: true });

	if (error || !data) {
		return [];
	}

	const admin = createSupabaseAdminClient();
	const members = await Promise.all(
		data.map(async (row) => {
			const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
			return {
				id: row.user_id,
				email: userData.user?.email ?? '(unknown)',
				role: row.role,
				status: row.status
			};
		})
	);

	return members;
}
