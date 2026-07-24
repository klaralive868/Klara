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

	// One listUsers() call rather than one getUserById() per member — avoids a
	// burst of parallel admin API calls (and the rate-limit/latency risk that
	// comes with it) on every page load.
	const admin = createSupabaseAdminClient();
	const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
	const emailById = new Map(usersPage?.users.map((u) => [u.id, u.email]) ?? []);

	return data.map((row) => ({
		id: row.user_id,
		email: emailById.get(row.user_id) ?? '(unknown)',
		role: row.role,
		status: row.status
	}));
}
