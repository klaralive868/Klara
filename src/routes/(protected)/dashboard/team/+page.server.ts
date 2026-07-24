import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getActiveOrganizationId } from '$lib/server/organization';
import { listOrganizationMembers } from '$lib/server/team';
import { inviteOrganizationMember } from '$lib/server/invite';
import type { Actions, PageServerLoad } from './$types';

const INVITABLE_ROLES = ['owner', 'manager', 'staff'] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitableRole(value: string): value is InvitableRole {
	return (INVITABLE_ROLES as readonly string[]).includes(value);
}

// A manager may not grant owner — only an owner can create another owner (or
// a manager). Without this, the earlier "is the inviter owner-or-manager"
// check alone lets any manager escalate an invitee straight to owner.
const ROLES_GRANTABLE_BY: Record<'owner' | 'manager', readonly InvitableRole[]> = {
	owner: INVITABLE_ROLES,
	manager: ['manager', 'staff']
};

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return { members: [], grantableRoles: [] };
	}

	const organizationId = await getActiveOrganizationId(locals.supabase, user.id);
	if (!organizationId) {
		return { members: [], grantableRoles: [] };
	}

	// Drives which roles the invite form's select offers — kept in sync with
	// the action's own ROLES_GRANTABLE_BY check below rather than duplicated,
	// so a staff member (who can't invite at all) sees no options and a
	// manager never sees "owner" as a selectable, doomed-to-403 choice.
	const { data: ownMembership } = await locals.supabase
		.from('organization_members')
		.select('role')
		.eq('user_id', user.id)
		.eq('status', 'active')
		.single();

	const ownRole = ownMembership?.role as 'owner' | 'manager' | 'staff' | undefined;
	const grantableRoles =
		ownRole === 'owner' || ownRole === 'manager' ? ROLES_GRANTABLE_BY[ownRole] : [];

	return {
		members: await listOrganizationMembers(locals.supabase, organizationId),
		grantableRoles
	};
};

export const actions: Actions = {
	invite: async ({ request, locals, url }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw redirect(303, '/sign-in');
		}

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const role = String(formData.get('role') ?? '');

		if (!email || !isInvitableRole(role)) {
			return fail(400, { inviteMessage: 'Enter a valid email and role.' });
		}

		// Only owners/managers may invite — checked server-side, first action, per
		// Standards §2 ("admin/privileged actions require an explicit operator-role
		// check... validated server-side, never inferred from the frontend").
		const { data: inviterMembership } = await locals.supabase
			.from('organization_members')
			.select('role, organization_id')
			.eq('user_id', user.id)
			.eq('status', 'active')
			.single();

		if (
			!inviterMembership ||
			(inviterMembership.role !== 'owner' && inviterMembership.role !== 'manager')
		) {
			return fail(403, { inviteMessage: 'Only owners and managers can invite teammates.' });
		}

		const inviterRole = inviterMembership.role as 'owner' | 'manager';
		if (!ROLES_GRANTABLE_BY[inviterRole].includes(role)) {
			return fail(403, { inviteMessage: `${inviterRole}s cannot invite ${role}s.` });
		}

		const admin = createSupabaseAdminClient();

		const result = await inviteOrganizationMember(admin, {
			email,
			organizationId: inviterMembership.organization_id,
			role,
			redirectTo: `${url.origin}/auth/confirm`
		});
		if (!result.ok) {
			return fail(400, { inviteMessage: result.message });
		}

		return { success: true, inviteMessage: `Invite sent to ${email}.` };
	}
};
