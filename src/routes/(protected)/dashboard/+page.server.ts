import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import type { Actions } from './$types';

const INVITABLE_ROLES = ['owner', 'manager', 'staff'] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitableRole(value: string): value is InvitableRole {
	return (INVITABLE_ROLES as readonly string[]).includes(value);
}

export const actions: Actions = {
	signOut: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		throw redirect(303, '/sign-in');
	},

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

		const admin = createSupabaseAdminClient();

		// Creates the invitee's auth.users row and emails the invite link — the
		// membership row below is created immediately after, using the id this
		// call returns (ADR-0002: pending-at-invite-time, service-role only).
		const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
			redirectTo: `${url.origin}/auth/confirm`
		});
		if (inviteError || !invited.user) {
			return fail(400, { inviteMessage: inviteError?.message ?? 'Could not send invite.' });
		}

		const { error: memberError } = await admin.from('organization_members').insert({
			user_id: invited.user.id,
			organization_id: inviterMembership.organization_id,
			role,
			status: 'pending'
		});
		if (memberError) {
			return fail(500, {
				inviteMessage: `Invite sent, but failed to create membership: ${memberError.message}`
			});
		}

		return { success: true, inviteMessage: `Invite sent to ${email}.` };
	}
};
