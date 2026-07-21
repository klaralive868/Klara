export type CatalogItemStatus = 'draft' | 'published' | 'archived';

export interface CatalogItem {
	id: string;
	name: string;
	description: string | null;
	priceCents: number;
	materialType: string;
	status: CatalogItemStatus;
}

// Raw shape of a row as returned by Supabase (snake_case columns).
export interface CatalogItemRow {
	id: string;
	name: string;
	description: string | null;
	price_cents: number;
	material_type: string;
	status: CatalogItemStatus;
}

export function catalogItemFromRow(row: CatalogItemRow): CatalogItem {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		priceCents: row.price_cents,
		materialType: row.material_type,
		status: row.status
	};
}
