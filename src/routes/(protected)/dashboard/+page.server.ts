import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import type { Actions } from './$types';

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

		const inviterRole = inviterMembership.role as 'owner' | 'manager';
		if (!ROLES_GRANTABLE_BY[inviterRole].includes(role)) {
			return fail(403, { inviteMessage: `${inviterRole}s cannot invite ${role}s.` });
		}

		const admin = createSupabaseAdminClient();

		// Creates the invitee's auth.users row and emails the invite link — the
		// membership row below is created immediately after, using the id this
		// call returns (ADR-0002: pending-at-invite-time, service-role only).
		const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
			redirectTo: `${url.origin}/auth/confirm`
		});
		if (inviteError || !invited.user) {
			// Supabase's raw error can include internal detail (e.g. "User already
			// registered"). The inviter is already a privileged, authenticated
			// caller, but this still shouldn't be a blank check on what leaks —
			// only the one known, actionable case is surfaced specifically.
			const message =
				inviteError?.code === 'email_exists'
					? 'That email already has an account.'
					: 'Could not send invite. Please try again.';
			return fail(400, { inviteMessage: message });
		}

		const { error: memberError } = await admin.from('organization_members').insert({
			user_id: invited.user.id,
			organization_id: inviterMembership.organization_id,
			role,
			status: 'pending'
		});
		if (memberError) {
			// The invite email already went out with no membership row behind it —
			// left as-is, the invitee's claim would silently dead-end at
			// "invalid-link" with no way to retry (a new invite would just find
			// this same, now-orphaned auth user). Undo the invite so a retry is clean.
			await admin.auth.admin.deleteUser(invited.user.id);
			return fail(500, { inviteMessage: 'Could not create the invite. Please try again.' });
		}

		return { success: true, inviteMessage: `Invite sent to ${email}.` };
	}
};
