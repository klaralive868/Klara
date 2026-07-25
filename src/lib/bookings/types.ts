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
