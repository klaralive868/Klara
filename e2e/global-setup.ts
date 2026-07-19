import { createAdminClient, E2E_TEST_ORG_NAME } from './admin-client';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './test-user';

export default async function globalSetup() {
	const admin = createAdminClient();

	// Idempotent: remove a leftover user from a previous run (e.g. one that
	// crashed before global-teardown ran) before recreating it. listUsers()
	// paginates (default 50/page) — perPage keeps this correct even as the
	// local dev auth.users table grows past that.
	const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
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
		.insert({ name: E2E_TEST_ORG_NAME })
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
