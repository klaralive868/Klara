import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, E2E_TEST_ORG_NAME } from './admin-client';
import {
	INVITER_EMAIL,
	INVITER_PASSWORD,
	MANAGER_EMAIL,
	MANAGER_PASSWORD,
	OPERATOR_EMAIL,
	OPERATOR_PASSWORD,
	TEST_USER_EMAIL,
	TEST_USER_PASSWORD
} from './test-user';

async function createActiveMember(
	admin: SupabaseClient,
	organizationId: string,
	email: string,
	password: string,
	role: 'owner' | 'manager' | 'staff'
) {
	const { data: created, error: createUserError } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (createUserError || !created.user) {
		throw new Error(`Failed to create e2e user ${email}: ${createUserError?.message}`);
	}

	const { error: memberError } = await admin.from('organization_members').insert({
		user_id: created.user.id,
		organization_id: organizationId,
		role,
		status: 'active',
		claimed_at: new Date().toISOString()
	});
	if (memberError) {
		throw new Error(`Failed to create e2e membership for ${email}: ${memberError.message}`);
	}

	return created.user;
}

export default async function globalSetup() {
	const admin = createAdminClient();

	// Idempotent: remove leftover users from a previous run (e.g. one that
	// crashed before global-teardown ran) before recreating them. listUsers()
	// paginates (default 50/page) — perPage keeps this correct even as the
	// local dev auth.users table grows past that.
	const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
	const staleEmails = new Set([TEST_USER_EMAIL, INVITER_EMAIL, MANAGER_EMAIL, OPERATOR_EMAIL]);
	for (const candidate of existing?.users ?? []) {
		if (candidate.email && staleEmails.has(candidate.email)) {
			await admin.auth.admin.deleteUser(candidate.id);
		}
	}

	const { data: organization, error: orgError } = await admin
		.from('organizations')
		.insert({ name: E2E_TEST_ORG_NAME })
		.select()
		.single();
	if (orgError || !organization) {
		throw new Error(`Failed to create e2e test organization: ${orgError?.message}`);
	}

	await createActiveMember(admin, organization.id, TEST_USER_EMAIL, TEST_USER_PASSWORD, 'owner');
	await createActiveMember(admin, organization.id, INVITER_EMAIL, INVITER_PASSWORD, 'owner');
	await createActiveMember(admin, organization.id, MANAGER_EMAIL, MANAGER_PASSWORD, 'manager');

	const operatorUser = await createActiveMember(
		admin,
		organization.id,
		OPERATOR_EMAIL,
		OPERATOR_PASSWORD,
		'staff'
	);
	const { error: operatorError } = await admin
		.from('operators')
		.insert({ user_id: operatorUser.id });
	if (operatorError) {
		throw new Error(
			`Failed to create e2e operator row for ${OPERATOR_EMAIL}: ${operatorError.message}`
		);
	}
}
