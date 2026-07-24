import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminOrganizationRow, AdminOrganizationStatus } from '$lib/admin/types';

// listUsers() is paginated (max 1000/page) — a single page: {perPage: 1000}
// call silently drops any user past the 1000-user mark, which would render
// as a missing owner email with no error surfaced. Loop until a page comes
// back short of a full page (Supabase's own signal there's no next page).
async function listAllUserEmailsById(admin: SupabaseClient): Promise<Map<string, string | null>> {
	const perPage = 1000;
	const emailById = new Map<string, string | null>();

	for (let page = 1; ; page++) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
		if (error) {
			console.error('admin: failed to load users (page', page, ')', error);
			break;
		}
		for (const user of data.users) {
			emailById.set(user.id, user.email ?? null);
		}
		if (data.users.length < perPage) {
			break;
		}
	}

	return emailById;
}

// `admin` must be a service-role client — an operator isn't necessarily a
// member of every organization, so the caller's own RLS-scoped client
// would only ever return the operator's own org (organizations_select_own),
// not the full list this page needs. Safe here specifically because the
// (admin) route group's layout guard has already verified the caller is a
// genuine operator before this is ever called (Standards §2).
export async function listOrganizationsForAdmin(
	admin: SupabaseClient
): Promise<AdminOrganizationRow[]> {
	const [orgsResult, membersResult, emailById] = await Promise.all([
		admin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }),
		admin.from('organization_members').select('organization_id, user_id, role, status'),
		listAllUserEmailsById(admin)
	]);

	if (orgsResult.error || !orgsResult.data) {
		console.error('admin: failed to load organizations', orgsResult.error);
		return [];
	}
	if (membersResult.error) {
		console.error('admin: failed to load organization members', membersResult.error);
	}

	const membersByOrg = new Map<string, { user_id: string; role: string; status: string }[]>();
	for (const row of membersResult.data ?? []) {
		const existing = membersByOrg.get(row.organization_id);
		if (existing) {
			existing.push(row);
		} else {
			membersByOrg.set(row.organization_id, [row]);
		}
	}

	return orgsResult.data.map((org) => {
		const members = membersByOrg.get(org.id) ?? [];
		// If more than one owner row somehow exists, the most recently
		// created membership wins — organization_members carries no
		// created_at ordering guarantee from this query, but any owner row
		// is equally valid for display purposes here.
		const owner = members.find((member) => member.role === 'owner');

		let status: AdminOrganizationStatus;
		if (!owner) {
			status = 'no-owner';
		} else {
			status = owner.status === 'active' ? 'active' : 'pending';
		}

		return {
			id: org.id,
			name: org.name,
			ownerEmail: owner ? (emailById.get(owner.user_id) ?? null) : null,
			status,
			createdAt: org.created_at,
			memberCount: members.length
		};
	});
}
