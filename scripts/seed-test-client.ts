/**
 * One-time bootstrap: creates a test client organization + owner + a module/
 * tier assignment. Run locally, never from the deployed app.
 *
 * Usage: npm run seed:test-client
 *
 * Requires (local env, never committed):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   <- service_role, bypasses RLS. Server/CI only.
 *   TEST_CLIENT_NAME
 *   TEST_CLIENT_OWNER_EMAIL
 *   TEST_CLIENT_OWNER_PASSWORD
 *
 * Optional:
 *   TEST_CLIENT_MODULE          <- defaults to 'catalog'
 *   TEST_CLIENT_TIER            <- defaults to 'clothing'
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientName = process.env.TEST_CLIENT_NAME;
const ownerEmail = process.env.TEST_CLIENT_OWNER_EMAIL;
const ownerPassword = process.env.TEST_CLIENT_OWNER_PASSWORD;
const module_ = process.env.TEST_CLIENT_MODULE ?? 'catalog';
const tier = process.env.TEST_CLIENT_TIER ?? 'clothing';

if (!url || !serviceRoleKey || !clientName || !ownerEmail || !ownerPassword) {
	throw new Error(
		'seed-test-client: missing required env var(s). Refusing to run with partial config ' +
			'(Standards §8 — fail loudly, never silently, on misconfiguration).'
	);
}

const supabase = createClient(url, serviceRoleKey, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// Duplicated from src/lib/slug.ts rather than imported — this script runs
// standalone via plain tsx, outside SvelteKit's $lib alias resolution.
function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

async function main() {
	// 1. Idempotency check — safe to rerun.
	const { data: existing, error: lookupError } = await supabase
		.from('organizations')
		.select('id')
		.eq('name', clientName)
		.maybeSingle();
	if (lookupError) throw new Error(`seed-test-client: lookup failed — ${lookupError.message}`);
	if (existing) {
		console.log(
			`seed-test-client: organization "${clientName}" already exists (id: ${existing.id}). Nothing to do.`
		);
		return;
	}

	// 2. Create the organization.
	const { data: organization, error: orgError } = await supabase
		.from('organizations')
		.insert({ name: clientName, slug: slugify(clientName) })
		.select('id')
		.single();
	if (orgError) {
		throw new Error(`seed-test-client: organization creation failed — ${orgError.message}`);
	}

	// 3. Create (or reuse) the owner's auth user — a real second business
	// needs its own owner account, distinct from the operator's own, since a
	// user can hold at most one active organization membership.
	const { data: existingUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
	let ownerId = existingUsers?.users.find((u) => u.email === ownerEmail)?.id;
	if (!ownerId) {
		const { data: userData, error: userError } = await supabase.auth.admin.createUser({
			email: ownerEmail,
			password: ownerPassword,
			email_confirm: true
		});
		if (userError) throw new Error(`seed-test-client: user creation failed — ${userError.message}`);
		ownerId = userData.user!.id;
	} else {
		console.log(
			`seed-test-client: owner user ${ownerEmail} already exists (id: ${ownerId}), reusing.`
		);
	}

	// 4. Link the owner to the organization.
	const { error: memberError } = await supabase.from('organization_members').insert({
		user_id: ownerId,
		organization_id: organization.id,
		role: 'owner',
		status: 'active',
		claimed_at: new Date().toISOString()
	});
	if (memberError) {
		throw new Error(`seed-test-client: membership creation failed — ${memberError.message}`);
	}

	// 5. Assign the module/tier.
	const { error: moduleError } = await supabase
		.from('client_modules')
		.insert({ organization_id: organization.id, module: module_, tier });
	if (moduleError) {
		throw new Error(`seed-test-client: module assignment failed — ${moduleError.message}`);
	}

	console.log(`seed-test-client: done. organization_id=${organization.id} owner_id=${ownerId}`);
	console.log(
		'seed-test-client: sign in with TEST_CLIENT_OWNER_EMAIL / TEST_CLIENT_OWNER_PASSWORD.'
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
