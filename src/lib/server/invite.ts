import type { SupabaseClient } from '@supabase/supabase-js';

export type InviteMemberRole = 'owner' | 'manager' | 'staff';

export type InviteMemberResult =
	| { ok: true; userId: string }
	// `kind` distinguishes a client error (bad/duplicate email — 400) from a
	// server error (the DB insert failed after a valid invite went out —
	// 500), so callers can pick the correct HTTP status instead of
	// collapsing both into one code (see git history: the pre-extraction
	// team action returned 400 and 500 respectively for these two cases).
	| { ok: false; kind: 'client' | 'server'; message: string };

// Invites a user via Supabase's native inviteUserByEmail (ADR-0002:
// service-role, Supabase-issued token — not a hand-rolled email/token
// system) and creates the corresponding organization_members row
// (status: pending). The two calls together are what "inviting someone"
// means in this app, whether the caller is a teammate invite (Team page,
// adding to an existing org) or an operator bootstrapping a brand-new
// org's first owner (admin portal) — the claim/set-password flow that
// later activates the row (src/routes/auth/confirm, src/routes/
// set-password) is identical either way, so both initiating paths share
// this one implementation rather than drifting apart.
//
// `admin` must already be a service-role client — this function does no
// authorization of its own; the caller is responsible for checking the
// caller has permission to invite into `organizationId` before calling
// this (Standards §2).
export async function inviteOrganizationMember(
	admin: SupabaseClient,
	params: {
		email: string;
		organizationId: string;
		role: InviteMemberRole;
		redirectTo: string;
		/** Stored in auth.users.user_metadata — display-only context (e.g. the invitee's name), never authorization-relevant (ADR-0002 keeps role out of metadata for exactly that reason). */
		metadata?: Record<string, unknown>;
	}
): Promise<InviteMemberResult> {
	const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
		params.email,
		{ redirectTo: params.redirectTo, data: params.metadata }
	);
	if (inviteError || !invited.user) {
		// Supabase's raw error can include internal detail (e.g. "User already
		// registered"). The caller is already a privileged, authorization-
		// checked operation, but this still shouldn't be a blank pass-through
		// of whatever Supabase says — only the one known, actionable case is
		// surfaced specifically.
		const message =
			inviteError?.code === 'email_exists'
				? 'That email already has an account.'
				: 'Could not send invite. Please try again.';
		return { ok: false, kind: 'client', message };
	}

	const { error: memberError } = await admin.from('organization_members').insert({
		user_id: invited.user.id,
		organization_id: params.organizationId,
		role: params.role,
		status: 'pending'
	});
	if (memberError) {
		// The invite email already went out with no membership row behind it —
		// left as-is, the invitee's claim would silently dead-end at
		// "invalid-link" with no way to retry (a new invite would just find
		// this same, now-orphaned auth user). Undo the invite so a retry is clean.
		await admin.auth.admin.deleteUser(invited.user.id);
		return { ok: false, kind: 'server', message: 'Could not create the invite. Please try again.' };
	}

	return { ok: true, userId: invited.user.id };
}
