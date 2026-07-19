import { createAdminClient, E2E_TEST_ORG_NAME } from './admin-client';
import { TEST_USER_EMAIL } from './test-user';

export default async function globalTeardown() {
	const admin = createAdminClient();

	const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
	const existingUser = existing?.users.find((candidate) => candidate.email === TEST_USER_EMAIL);
	if (existingUser) {
		// Cascades to the user's organization_members row (on delete cascade).
		await admin.auth.admin.deleteUser(existingUser.id);
	}

	// Deletes by name rather than a tracked id so this also mops up any
	// orphaned rows left behind by a run that crashed before this ran.
	await admin.from('organizations').delete().eq('name', E2E_TEST_ORG_NAME);
}
