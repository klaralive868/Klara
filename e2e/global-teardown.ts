import { createAdminClient, E2E_SECOND_ORG_NAME, E2E_TEST_ORG_NAME } from './admin-client';
import {
	CATALOG_OWNER_EMAIL,
	CATEGORIES_OWNER_EMAIL,
	IMAGES_OWNER_EMAIL,
	INVITEE_EMAIL_PREFIX,
	INVITER_EMAIL,
	MANAGER_EMAIL,
	OPERATOR_EMAIL,
	SECOND_ORG_EMAIL,
	TEST_USER_EMAIL
} from './test-user';

export default async function globalTeardown() {
	const admin = createAdminClient();

	const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

	const staleUsers = (existing?.users ?? []).filter(
		(candidate) =>
			candidate.email === TEST_USER_EMAIL ||
			candidate.email === INVITER_EMAIL ||
			candidate.email === MANAGER_EMAIL ||
			candidate.email === OPERATOR_EMAIL ||
			candidate.email === SECOND_ORG_EMAIL ||
			candidate.email === CATALOG_OWNER_EMAIL ||
			candidate.email === CATEGORIES_OWNER_EMAIL ||
			candidate.email === IMAGES_OWNER_EMAIL ||
			candidate.email?.startsWith(INVITEE_EMAIL_PREFIX)
	);
	for (const user of staleUsers) {
		// Cascades to that user's organization_members/operators row(s) (on delete cascade).
		await admin.auth.admin.deleteUser(user.id);
	}

	// Deletes by name rather than a tracked id so this also mops up any
	// orphaned rows left behind by a run that crashed before this ran.
	await admin.from('organizations').delete().eq('name', E2E_TEST_ORG_NAME);
	await admin.from('organizations').delete().eq('name', E2E_SECOND_ORG_NAME);
}
