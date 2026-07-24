import { fail, redirect } from '@sveltejs/kit';
import { isOperator } from '$lib/server/operator';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { parseCreateClientForm } from '$lib/server/admin-provisioning';
import { inviteOrganizationMember } from '$lib/server/invite';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		// The (admin) layout guard already checked this, but that guard runs in
		// load() only — SvelteKit form actions do not go through the parent
		// layout's load(), so a POST straight to this action would otherwise
		// skip the check entirely (Standards §2: re-check here, don't rely
		// solely on the layout gate).
		const { session, user } = await locals.safeGetSession();
		if (!session || !user || !(await isOperator(locals.supabase, user.id))) {
			return fail(403, { message: 'Not authorized.' });
		}

		const formData = await request.formData();
		const parsed = parseCreateClientForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const admin = createSupabaseAdminClient();

		const { data: org, error: orgError } = await admin
			.from('organizations')
			.insert({ name: parsed.value.businessName })
			.select('id')
			.single();
		if (orgError || !org) {
			console.error('admin: failed to create organization', orgError);
			return fail(500, { message: 'Could not create the client. Please try again.' });
		}

		const result = await inviteOrganizationMember(admin, {
			email: parsed.value.ownerEmail,
			organizationId: org.id,
			role: 'owner',
			redirectTo: `${url.origin}/auth/confirm`,
			metadata: { full_name: parsed.value.ownerFullName }
		});

		if (!result.ok) {
			// Don't leave an org behind with no invite sent and no way to retry
			// cleanly through this UI — the membership row (if it got as far as
			// being created) cascades away with the org (on delete cascade).
			const { error: rollbackError } = await admin.from('organizations').delete().eq('id', org.id);
			if (rollbackError) {
				console.error('admin: failed to roll back orphaned organization', org.id, rollbackError);
			}
			return fail(result.kind === 'server' ? 500 : 400, { message: result.message });
		}

		// TODO: module assignment / featured-module curation is a separate,
		// later admin action — new orgs intentionally start with zero modules
		// enabled (Standards §10: not in scope for this ticket).

		throw redirect(303, '/admin');
	}
};
