export type ResourceStatus = 'draft' | 'published' | 'archived';

export interface Resource {
	id: string;
	name: string;
	description: string | null;
	departureDate: string;
	returnDate: string;
	quantity: number | null;
	requiresManualConfirmation: boolean;
	priceCents: number;
	status: ResourceStatus;
}

// Raw shape of a row as returned by Supabase (snake_case columns).
export interface ResourceRow {
	id: string;
	name: string;
	description: string | null;
	departure_date: string;
	return_date: string;
	quantity: number | null;
	requires_manual_confirmation: boolean;
	price_cents: number;
	status: ResourceStatus;
}

export function resourceFromRow(row: ResourceRow): Resource {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		departureDate: row.departure_date,
		returnDate: row.return_date,
		quantity: row.quantity,
		requiresManualConfirmation: row.requires_manual_confirmation,
		priceCents: row.price_cents,
		status: row.status
	};
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
	id: string;
	resourceId: string;
	resourceName: string;
	customerId: string;
	customerName: string;
	customerEmail: string | null;
	travelerCount: number;
	notes: string | null;
	status: BookingStatus;
	departureDate: string;
	returnDate: string;
}

// Raw shape of a row as returned by Supabase, joined with the resource's
// name/dates and the customer's name/email via nested selects — a booking
// is never displayed without knowing what it's for and who it's for, so the
// join is baked into the one shape callers work with rather than requiring
// two extra lookups per render.
export interface BookingRow {
	id: string;
	resource_id: string;
	customer_id: string;
	traveler_count: number;
	notes: string | null;
	status: BookingStatus;
	start_at: string;
	end_at: string;
	resources: { name: string } | null;
	customers: { full_name: string; email: string | null } | null;
}

export function bookingFromRow(row: BookingRow): Booking {
	return {
		id: row.id,
		resourceId: row.resource_id,
		resourceName: row.resources?.name ?? 'Unknown package',
		customerId: row.customer_id,
		customerName: row.customers?.full_name ?? 'Unknown customer',
		customerEmail: row.customers?.email ?? null,
		travelerCount: row.traveler_count,
		notes: row.notes,
		status: row.status,
		departureDate: row.start_at,
		returnDate: row.end_at
	};
}

export interface SeatCounts {
	confirmed: number;
	pending: number;
}

export function bookingStatusVariant(status: BookingStatus) {
	if (status === 'confirmed') return 'default';
	if (status === 'completed') return 'secondary';
	if (status === 'cancelled') return 'destructive';
	return 'outline';
}
