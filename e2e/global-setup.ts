import { createClient } from '@supabase/supabase-js';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './test-user';

export default async function globalSetup() {
	process.loadEnvFile?.('.env');

	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for e2e setup');
	}

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// Idempotent: remove a leftover user from a previous run before recreating it.
	const { data: existing } = await admin.auth.admin.listUsers();
	const existingUser = existing?.users.find((candidate) => candidate.email === TEST_USER_EMAIL);
	if (existingUser) {
		await admin.auth.admin.deleteUser(existingUser.id);
	}

	const { data: created, error: createUserError } = await admin.auth.admin.createUser({
		email: TEST_USER_EMAIL,
		password: TEST_USER_PASSWORD,
		email_confirm: true
	});
	if (createUserError || !created.user) {
		throw new Error(`Failed to create e2e test user: ${createUserError?.message}`);
	}

	const { data: organization, error: orgError } = await admin
		.from('organizations')
		.insert({ name: 'E2E Test Org' })
		.select()
		.single();
	if (orgError || !organization) {
		throw new Error(`Failed to create e2e test organization: ${orgError?.message}`);
	}

	const { error: memberError } = await admin.from('organization_members').insert({
		user_id: created.user.id,
		organization_id: organization.id,
		role: 'owner',
		status: 'active',
		claimed_at: new Date().toISOString()
	});
	if (memberError) {
		throw new Error(`Failed to create e2e test membership: ${memberError.message}`);
	}
}
