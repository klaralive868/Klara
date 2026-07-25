import { json } from '@sveltejs/kit';
import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import type { RequestHandler } from './$types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A minimal customer-creation endpoint for CustomerPicker's inline "+ Create
// new customer" flow (the manual booking form) — deliberately just the core
// fields (name/email/phone), no dynamic custom_fields, since the picker's
// job is picking a customer to attach to a booking, not the full customer
// intake form at /dashboard/customers/new. Plain JSON in/out rather than a
// SvelteKit form action, since it's called from a nested widget inside
// another <form> (a nested <form>/action isn't valid HTML) via a direct
// fetch(), not a submission.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		return json({ error: 'Not signed in.' }, { status: 401 });
	}

	const body = await request.json();
	const fullName = String(body.fullName ?? '').trim();
	const email = String(body.email ?? '').trim();
	const phone = String(body.phone ?? '').trim();

	if (!fullName) {
		return json({ error: 'Enter a full name.' }, { status: 400 });
	}
	if (!EMAIL_PATTERN.test(email)) {
		return json({ error: 'Enter a valid email.' }, { status: 400 });
	}

	// organization_id defaults to the caller's own organization (see the
	// customers migration) — never accepted from the client.
	const { data, error } = await locals.supabase
		.from('customers')
		.insert({
			full_name: fullName,
			email,
			phone: phone || null
		})
		.select('id, full_name, email, phone, custom_fields, source, status')
		.single();

	if (error || !data) {
		if (error?.code === '23505') {
			return json(
				{ error: 'A customer with this email already exists in your organization.' },
				{ status: 400 }
			);
		}
		return json({ error: 'Could not create the customer. Please try again.' }, { status: 500 });
	}

	return json({ customer: customerFromRow(data as CustomerRow) });
};
