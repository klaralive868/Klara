import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResourceImage } from '$lib/bookings/types';

const IMAGE_BUCKET = 'resource-images';

// The subset of a Resource safe to send to an unauthenticated visitor.
// `quantity` (seat capacity) and `requiresManualConfirmation` are agent-only
// (docs/bookings-travel-packages-spec.md) — deliberately shaped out here, at
// the load boundary, rather than trusted to just stay unrendered by the
// template. SvelteKit ships whatever `load()` returns to the client as page
// data regardless of what the markup actually displays, so withholding a
// field only in the template doesn't withhold it from the response.
export interface PublicResource {
	id: string;
	name: string;
	description: string;
	departureDate: string;
	returnDate: string;
	priceCents: number;
	// Primary image first, then upload order — same ordering the
	// authenticated dashboard uses (resource_images has no separate
	// display_order column; created_at is the only ordering signal).
	// Always an array, never omitted/null, even when empty.
	images: ResourceImage[];
}

interface PublicResourceRow {
	id: string;
	name: string;
	description: string | null;
	departure_date: string;
	return_date: string;
	price_cents: number;
}

interface ResourceImageRow {
	id: string;
	resource_id: string;
	storage_path: string;
	is_primary: boolean;
}

const PUBLIC_RESOURCE_COLUMNS = 'id, name, description, departure_date, return_date, price_cents';

// resource_images itself is authenticated-only RLS (see its migration) —
// `admin` (service-role, bypasses RLS) is required to read it here, same as
// for `resources`. The Storage bucket backing it is public (ADR-0007), so
// getPublicUrl is a synchronous, local URL construction, not a signed URL
// or an extra network round trip.
function toImageUrl(admin: SupabaseClient, storagePath: string): string {
	return admin.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function toResourceImage(admin: SupabaseClient, row: ResourceImageRow): ResourceImage {
	return {
		id: row.id,
		isPrimary: row.is_primary,
		url: toImageUrl(admin, row.storage_path)
	};
}

// Primary first, then whatever order the query already returned (created_at
// ascending) — a plain boolean sort is stable in V8/Node, so ties (i.e.
// every non-primary row) keep their relative order.
function sortPrimaryFirst(images: ResourceImage[]): ResourceImage[] {
	return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

function toPublicResource(row: PublicResourceRow, images: ResourceImage[]): PublicResource {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		departureDate: row.departure_date,
		returnDate: row.return_date,
		priceCents: row.price_cents,
		images: sortPrimaryFirst(images)
	};
}

export async function listPublishedResources(
	admin: SupabaseClient,
	organizationId: string
): Promise<PublicResource[]> {
	const { data, error } = await admin
		.from('resources')
		.select(PUBLIC_RESOURCE_COLUMNS)
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.order('departure_date', { ascending: true });

	if (error || !data) {
		return [];
	}

	const rows = data as PublicResourceRow[];

	// One batched query for every returned resource's images, not one query
	// per resource — a per-resource query here would turn a list endpoint
	// into an N+1 as soon as an org has more than a handful of packages.
	const imagesByResourceId = new Map<string, ResourceImage[]>();
	if (rows.length > 0) {
		const { data: imageRows } = await admin
			.from('resource_images')
			.select('id, resource_id, storage_path, is_primary')
			.in(
				'resource_id',
				rows.map((row) => row.id)
			)
			.order('created_at', { ascending: true });

		for (const row of (imageRows ?? []) as ResourceImageRow[]) {
			const image = toResourceImage(admin, row);
			const existing = imagesByResourceId.get(row.resource_id);
			if (existing) {
				existing.push(image);
			} else {
				imagesByResourceId.set(row.resource_id, [image]);
			}
		}
	}

	return rows.map((row) => toPublicResource(row, imagesByResourceId.get(row.id) ?? []));
}

// A draft/archived resource — or one belonging to a different organization
// than the one resolved from the URL's slug — returns null the same way a
// nonexistent id would. The caller 404s either way, so a visitor can never
// distinguish "no such package" from "not public yet" or "wrong organization".
export async function getPublishedResource(
	admin: SupabaseClient,
	organizationId: string,
	id: string
): Promise<PublicResource | null> {
	const { data, error } = await admin
		.from('resources')
		.select(PUBLIC_RESOURCE_COLUMNS)
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.eq('id', id)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	const { data: imageRows } = await admin
		.from('resource_images')
		.select('id, resource_id, storage_path, is_primary')
		.eq('resource_id', id)
		.order('created_at', { ascending: true });

	const images = ((imageRows ?? []) as ResourceImageRow[]).map((row) =>
		toResourceImage(admin, row)
	);

	return toPublicResource(data as PublicResourceRow, images);
}
