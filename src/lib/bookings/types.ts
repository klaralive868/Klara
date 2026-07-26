export type ResourceStatus = 'draft' | 'published' | 'archived';

// url is a plain public Storage URL (resource-images is a public bucket,
// docs/adr/0007-resource-images-public-bucket.md), not signed/expiring —
// unlike Catalog's equivalent, which deliberately keeps images private.
export interface ResourceImage {
	id: string;
	isPrimary: boolean;
	url: string;
}

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

// The one select string every booking query uses — a booking is never
// fetched without the resource/customer join, so there's no "bare" variant
// for a caller to accidentally use instead.
export const BOOKING_SELECT =
	'id, resource_id, customer_id, traveler_count, notes, status, start_at, end_at, resources(name), customers(full_name, email)';

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

export type TravelInquiryStatus = 'new' | 'in-progress' | 'converted' | 'closed';

export interface TravelInquiry {
	id: string;
	customerId: string;
	customerName: string;
	customerEmail: string | null;
	tripDescription: string;
	preferredDates: string | null;
	partySize: number | null;
	budget: string | null;
	notes: string | null;
	status: TravelInquiryStatus;
}

// A travel inquiry is never displayed without knowing who it's for, so the
// customer join is baked into the one select string every query uses — same
// reasoning as BOOKING_SELECT above.
export const TRAVEL_INQUIRY_SELECT =
	'id, customer_id, trip_description, preferred_dates, party_size, budget, notes, status, customers(full_name, email)';

export interface TravelInquiryRow {
	id: string;
	customer_id: string;
	trip_description: string;
	preferred_dates: string | null;
	party_size: number | null;
	budget: string | null;
	notes: string | null;
	status: TravelInquiryStatus;
	customers: { full_name: string; email: string | null } | null;
}

export function travelInquiryFromRow(row: TravelInquiryRow): TravelInquiry {
	return {
		id: row.id,
		customerId: row.customer_id,
		customerName: row.customers?.full_name ?? 'Unknown customer',
		customerEmail: row.customers?.email ?? null,
		tripDescription: row.trip_description,
		preferredDates: row.preferred_dates,
		partySize: row.party_size,
		budget: row.budget,
		notes: row.notes,
		status: row.status
	};
}

export function travelInquiryStatusVariant(status: TravelInquiryStatus) {
	if (status === 'in-progress') return 'default';
	if (status === 'converted') return 'secondary';
	if (status === 'closed') return 'destructive';
	return 'outline';
}
