import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicResource } from '$lib/bookings/placeholder-resources';

interface PublicResourceRow {
	id: string;
	name: string;
	description: string | null;
	departure_date: string;
	return_date: string;
	price_cents: number;
}

// imageCount is always 0 for now — resource_images (ticket #40) doesn't
// exist yet, so there's nothing real to count. quantity/requires_manual_
// confirmation are deliberately never selected here: they're agent-only
// (docs/bookings-travel-packages-spec.md), so a public route can't leak
// them even by accident.
function toPublicResource(row: PublicResourceRow): PublicResource {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		departureDate: row.departure_date,
		returnDate: row.return_date,
		priceCents: row.price_cents,
		imageCount: 0
	};
}

export async function listPublishedResources(
	supabase: SupabaseClient,
	organizationId: string
): Promise<PublicResource[]> {
	const { data, error } = await supabase
		.from('resources')
		.select('id, name, description, departure_date, return_date, price_cents')
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.order('departure_date', { ascending: true });

	if (error || !data) {
		return [];
	}

	return (data as PublicResourceRow[]).map(toPublicResource);
}

// A draft/archived resource — or one belonging to a different organization
// than the one resolved from the URL's slug — returns null the same way a
// nonexistent id would. The caller 404s either way, so a visitor can never
// distinguish "no such package" from "not public yet" or "wrong organization".
export async function getPublishedResource(
	supabase: SupabaseClient,
	organizationId: string,
	id: string
): Promise<PublicResource | null> {
	const { data, error } = await supabase
		.from('resources')
		.select('id, name, description, departure_date, return_date, price_cents')
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.eq('id', id)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	return toPublicResource(data as PublicResourceRow);
}
