import { error, fail } from '@sveltejs/kit';
import { isOperator } from '$lib/server/operator';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getClientModulesForAdmin, getOrganizationForAdmin } from '$lib/server/admin-organizations';
import { parseModuleAssignmentForm } from '$lib/server/client-modules';
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

	// getClientModulesForAdmin throws on a real query failure (as opposed to
	// "zero modules") — surfaced here as a clean 500 rather than letting the
	// page render as if the org had no modules, which the save action below
	// would then take as license to delete real ones.
	let modules;
	try {
		modules = await getClientModulesForAdmin(admin, params.id);
	} catch {
		error(500, "Could not load this organization's modules.");
	}

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
		// sync_client_modules replaces the org's full module rowset in one
		// transaction (delete-then-insert), so a mid-sequence failure can't
		// leave only a prefix of the requested modules applied — same
		// atomicity precedent as sync_catalog_item_stock.
		const { error: syncError } = await admin.rpc('sync_client_modules', {
			p_organization_id: params.id,
			p_entries: parsed.value
		});
		if (syncError) {
			console.error('admin: failed to sync modules', params.id, syncError);
			return fail(500, { message: 'Could not save module changes. Please try again.' });
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
