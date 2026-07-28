import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
	process.loadEnvFile?.('.env');

	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for e2e setup');
	}

	return createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

export const E2E_TEST_ORG_NAME = 'E2E Test Org';
export const E2E_SECOND_ORG_NAME = 'E2E Second Org';

// organizations.slug is not null unique — these seeded orgs need one too,
// same as any org created through the real admin-provisioning flow.
export const E2E_TEST_ORG_SLUG = 'e2e-test-org';
export const E2E_SECOND_ORG_SLUG = 'e2e-second-org';

// public-booking.spec.ts's own dedicated organization — needs published and
// draft resources seeded ahead of time (no dashboard session in that spec to
// create them through the UI, unlike resource-crud.spec.ts).
export const E2E_BOOKING_ORG_NAME = 'E2E Public Booking Org';
export const E2E_BOOKING_ORG_SLUG = 'e2e-public-booking-org';
export const E2E_BOOKING_PUBLISHED_RESOURCE_NAME = 'E2E Public Booking Published Package';
export const E2E_BOOKING_DRAFT_RESOURCE_NAME = 'E2E Public Booking Draft Package';

// public-api-bookings.spec.ts's allowlisted origin for E2E_BOOKING_ORG,
// standing in for a client's real external site (ADR-0008 / Standards §12).
export const E2E_BOOKING_ALLOWED_ORIGIN = 'https://client-site.example';
