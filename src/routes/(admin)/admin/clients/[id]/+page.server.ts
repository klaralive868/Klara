import { error, fail } from '@sveltejs/kit';
import { isOperator } from '$lib/server/operator';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getClientModulesForAdmin, getOrganizationForAdmin } from '$lib/server/admin-organizations';
import { diffClientModules, parseModuleAssignmentForm } from '$lib/server/client-modules';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// The (admin) layout guard already checked this in load(), but load()
	// here runs as a sibling, not a re-entry into that guard for every
	// request path — re-checked anyway for the same reason actions below
	// re-check it (Standards §2).
	const { session, user } = await locals.safeGetSession();
	if (!session || !user || !(await isOperator(locals.supabase, user.id))) {
		error(404, 'Not found');
	}

	const admin = createSupabaseAdminClient();
	const organization = await getOrganizationForAdmin(admin, params.id);
	if (!organization) {
		error(404, 'Organization not found');
	}

	const modules = await getClientModulesForAdmin(admin, params.id);

	return { organization, modules };
};

export const actions: Actions = {
	updateModules: async ({ request, params, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user || !(await isOperator(locals.supabase, user.id))) {
			return fail(403, { message: 'Not authorized.' });
		}

		const formData = await request.formData();
		const parsed = parseModuleAssignmentForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const admin = createSupabaseAdminClient();
		const current = await getClientModulesForAdmin(admin, params.id);
		const diff = diffClientModules(current, parsed.value);

		if (diff.toInsert.length > 0) {
			const { error: insertError } = await admin.from('client_modules').insert(
				diff.toInsert.map((row) => ({
					organization_id: params.id,
					module: row.module,
					tier: row.tier
				}))
			);
			if (insertError) {
				console.error('admin: failed to enable modules', params.id, insertError);
				return fail(500, { message: 'Could not save module changes. Please try again.' });
			}
		}

		for (const row of diff.toUpdate) {
			const { error: updateError } = await admin
				.from('client_modules')
				.update({ tier: row.tier })
				.eq('organization_id', params.id)
				.eq('module', row.module);
			if (updateError) {
				console.error('admin: failed to update module tier', params.id, updateError);
				return fail(500, { message: 'Could not save module changes. Please try again.' });
			}
		}

		if (diff.toDelete.length > 0) {
			const { error: deleteError } = await admin
				.from('client_modules')
				.delete()
				.eq('organization_id', params.id)
				.in('module', diff.toDelete);
			if (deleteError) {
				console.error('admin: failed to disable modules', params.id, deleteError);
				return fail(500, { message: 'Could not save module changes. Please try again.' });
			}
		}

		return { success: true, message: 'Modules updated.' };
	},

	archive: async ({ params, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user || !(await isOperator(locals.supabase, user.id))) {
			return fail(403, { message: 'Not authorized.' });
		}

		const admin = createSupabaseAdminClient();
		const { data, error: updateError } = await admin
			.from('organizations')
			.update({ status: 'archived' })
			.eq('id', params.id)
			.eq('status', 'active')
			.select('id')
			.maybeSingle();

		if (updateError) {
			console.error('admin: failed to archive organization', params.id, updateError);
			return fail(500, { message: 'Could not deactivate the organization. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Organization not found or already deactivated.' });
		}

		return { success: true, message: 'Organization deactivated.' };
	},

	unarchive: async ({ params, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user || !(await isOperator(locals.supabase, user.id))) {
			return fail(403, { message: 'Not authorized.' });
		}

		const admin = createSupabaseAdminClient();
		const { data, error: updateError } = await admin
			.from('organizations')
			.update({ status: 'active' })
			.eq('id', params.id)
			.eq('status', 'archived')
			.select('id')
			.maybeSingle();

		if (updateError) {
			console.error('admin: failed to reactivate organization', params.id, updateError);
			return fail(500, { message: 'Could not reactivate the organization. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Organization not found or not deactivated.' });
		}

		return { success: true, message: 'Organization reactivated.' };
	}
};
