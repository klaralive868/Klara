import type { SupabaseClient } from '@supabase/supabase-js';
import {
	createAdminClient,
	E2E_SECOND_ORG_NAME,
	E2E_SECOND_ORG_SLUG,
	E2E_TEST_ORG_NAME,
	E2E_TEST_ORG_SLUG
} from './admin-client';
import {
	ADMIN_PROVISIONING_NON_OPERATOR_EMAIL,
	ADMIN_PROVISIONING_NON_OPERATOR_PASSWORD,
	CATALOG_OWNER_EMAIL,
	CATALOG_OWNER_PASSWORD,
	CATEGORIES_OWNER_EMAIL,
	CATEGORIES_OWNER_PASSWORD,
	CUSTOMERS_OWNER_EMAIL,
	CUSTOMERS_OWNER_PASSWORD,
	IMAGES_OWNER_EMAIL,
	IMAGES_OWNER_PASSWORD,
	INVITER_EMAIL,
	INVITER_PASSWORD,
	LIST_TABLE_OWNER_EMAIL,
	LIST_TABLE_OWNER_PASSWORD,
	MANAGER_EMAIL,
	MANAGER_PASSWORD,
	OPERATOR_EMAIL,
	OPERATOR_PASSWORD,
	RESOURCES_OWNER_EMAIL,
	RESOURCES_OWNER_PASSWORD,
	SECOND_ORG_EMAIL,
	SECOND_ORG_PASSWORD,
	STOCK_OWNER_EMAIL,
	STOCK_OWNER_PASSWORD,
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
	const staleEmails = new Set([
		TEST_USER_EMAIL,
		INVITER_EMAIL,
		MANAGER_EMAIL,
		OPERATOR_EMAIL,
		SECOND_ORG_EMAIL,
		CATALOG_OWNER_EMAIL,
		CATEGORIES_OWNER_EMAIL,
		IMAGES_OWNER_EMAIL,
		STOCK_OWNER_EMAIL,
		LIST_TABLE_OWNER_EMAIL,
		CUSTOMERS_OWNER_EMAIL,
		ADMIN_PROVISIONING_NON_OPERATOR_EMAIL,
		RESOURCES_OWNER_EMAIL
	]);
	for (const candidate of existing?.users ?? []) {
		if (candidate.email && staleEmails.has(candidate.email)) {
			await admin.auth.admin.deleteUser(candidate.id);
		}
	}

	const { data: organization, error: orgError } = await admin
		.from('organizations')
		.insert({ name: E2E_TEST_ORG_NAME, slug: E2E_TEST_ORG_SLUG })
		.select()
		.single();
	if (orgError || !organization) {
		throw new Error(`Failed to create e2e test organization: ${orgError?.message}`);
	}

	await createActiveMember(admin, organization.id, TEST_USER_EMAIL, TEST_USER_PASSWORD, 'owner');
	await createActiveMember(admin, organization.id, INVITER_EMAIL, INVITER_PASSWORD, 'owner');
	await createActiveMember(admin, organization.id, MANAGER_EMAIL, MANAGER_PASSWORD, 'manager');
	await createActiveMember(
		admin,
		organization.id,
		CATALOG_OWNER_EMAIL,
		CATALOG_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		CATEGORIES_OWNER_EMAIL,
		CATEGORIES_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		IMAGES_OWNER_EMAIL,
		IMAGES_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		STOCK_OWNER_EMAIL,
		STOCK_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		LIST_TABLE_OWNER_EMAIL,
		LIST_TABLE_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		CUSTOMERS_OWNER_EMAIL,
		CUSTOMERS_OWNER_PASSWORD,
		'owner'
	);
	await createActiveMember(
		admin,
		organization.id,
		ADMIN_PROVISIONING_NON_OPERATOR_EMAIL,
		ADMIN_PROVISIONING_NON_OPERATOR_PASSWORD,
		'staff'
	);
	await createActiveMember(
		admin,
		organization.id,
		RESOURCES_OWNER_EMAIL,
		RESOURCES_OWNER_PASSWORD,
		'owner'
	);

	// A required text field and an optional select field — enough for
	// customers-crud.spec.ts to exercise both dynamic-field render paths
	// (required-field validation, select-option validation) without needing
	// its own seed script.
	const { error: fieldDefError } = await admin.from('customer_field_definitions').insert([
		{
			organization_id: organization.id,
			field_key: 'pet_name',
			label: 'Pet name',
			field_type: 'text',
			required: true,
			display_order: 1
		},
		{
			organization_id: organization.id,
			field_key: 'preferred_groomer',
			label: 'Preferred groomer',
			field_type: 'select',
			options: ['Alex', 'Sam'],
			required: false,
			display_order: 2
		}
	]);
	if (fieldDefError) {
		throw new Error(`Failed to seed e2e customer field definitions: ${fieldDefError.message}`);
	}

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

	const { data: secondOrganization, error: secondOrgError } = await admin
		.from('organizations')
		.insert({ name: E2E_SECOND_ORG_NAME, slug: E2E_SECOND_ORG_SLUG })
		.select()
		.single();
	if (secondOrgError || !secondOrganization) {
		throw new Error(`Failed to create e2e second test organization: ${secondOrgError?.message}`);
	}
	await createActiveMember(
		admin,
		secondOrganization.id,
		SECOND_ORG_EMAIL,
		SECOND_ORG_PASSWORD,
		'owner'
	);
}
