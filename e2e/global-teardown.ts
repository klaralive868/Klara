import { createAdminClient, E2E_TEST_ORG_NAME } from './admin-client';
import { INVITEE_EMAIL_PREFIX, INVITER_EMAIL, TEST_USER_EMAIL } from './test-user';

export default async function globalTeardown() {
	const admin = createAdminClient();

	const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

	const staleUsers = (existing?.users ?? []).filter(
		(candidate) =>
			candidate.email === TEST_USER_EMAIL ||
			candidate.email === INVITER_EMAIL ||
			candidate.email?.startsWith(INVITEE_EMAIL_PREFIX)
	);
	for (const user of staleUsers) {
		// Cascades to that user's organization_members row(s) (on delete cascade).
		await admin.auth.admin.deleteUser(user.id);
	}

	// Deletes by name rather than a tracked id so this also mops up any
	// orphaned rows left behind by a run that crashed before this ran.
	await admin.from('organizations').delete().eq('name', E2E_TEST_ORG_NAME);
}
