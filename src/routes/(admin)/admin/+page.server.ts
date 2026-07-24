import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { listOrganizationsForAdmin } from '$lib/server/admin-organizations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Safe to construct the service-role client here: the (admin) layout
	// guard has already verified the caller is an operator (Standards §2).
	const admin = createSupabaseAdminClient();
	const organizations = await listOrganizationsForAdmin(admin);

	return { organizations };
};
