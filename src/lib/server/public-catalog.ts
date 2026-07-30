import type { SupabaseClient } from '@supabase/supabase-js';

const IMAGE_BUCKET = 'catalog-images';

export interface PublicCatalogImage {
	id: string;
	isPrimary: boolean;
	url: string;
}

// Stock is deliberately exposed as booleans, never exact counts — same
// precedent as Bookings' public API withholding quantity/
// requiresManualConfirmation as agent-only (public-resources.ts). A
// storefront needs "can I buy this," not the warehouse number.
//
// null for a sizeless item (no sizes exist to report on at all — check
// `inStock` instead). For a sized item, only sizes that currently have
// stock appear as keys; a size that's never been offered and a size that's
// sold out are indistinguishable here (catalog_item_stock only persists
// rows with quantity > 0 — sync_catalog_item_stock drops the rest), which
// is an existing limitation of the underlying data model, not something
// introduced by this API.
export interface PublicCatalogItem {
	id: string;
	name: string;
	description: string;
	priceCents: number;
	materialType: string;
	images: PublicCatalogImage[];
	unlimitedStock: boolean;
	inStock: boolean;
	stockBySize: Record<string, boolean> | null;
}

interface PublicCatalogItemRow {
	id: string;
	name: string;
	description: string | null;
	price_cents: number;
	material_type: string;
	unlimited_stock: boolean;
}

interface StockRow {
	item_id: string;
	size: string | null;
	quantity: number;
}

interface ImageRow {
	id: string;
	item_id: string;
	storage_path: string;
	is_primary: boolean;
}

const PUBLIC_ITEM_COLUMNS = 'id, name, description, price_cents, material_type, unlimited_stock';

function toImageUrl(admin: SupabaseClient, storagePath: string): string {
	return admin.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function toPublicImage(admin: SupabaseClient, row: ImageRow): PublicCatalogImage {
	return {
		id: row.id,
		isPrimary: row.is_primary,
		url: toImageUrl(admin, row.storage_path)
	};
}

function sortPrimaryFirst(images: PublicCatalogImage[]): PublicCatalogImage[] {
	return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

function toStockBySize(stockRows: StockRow[]): Record<string, boolean> | null {
	// A single `size IS NULL` row is the sizeless-item convention
	// (catalog_item_stock's partial unique indexes) — there's no per-size
	// breakdown to report for it, `inStock` covers purchasability instead.
	const sized = stockRows.filter((row) => row.size !== null);
	if (sized.length === 0) {
		return null;
	}
	const bySize: Record<string, boolean> = {};
	for (const row of sized) {
		bySize[row.size as string] = row.quantity > 0;
	}
	return bySize;
}

function toPublicCatalogItem(
	row: PublicCatalogItemRow,
	stockRows: StockRow[],
	images: PublicCatalogImage[]
): PublicCatalogItem {
	const stockBySize = toStockBySize(stockRows);
	const anySizedInStock = stockBySize ? Object.values(stockBySize).some(Boolean) : false;
	const sizelessInStock = stockRows.some((r) => r.size === null && r.quantity > 0);

	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		priceCents: row.price_cents,
		materialType: row.material_type,
		images: sortPrimaryFirst(images),
		unlimitedStock: row.unlimited_stock,
		inStock: row.unlimited_stock || anySizedInStock || sizelessInStock,
		stockBySize
	};
}

export async function listPublishedCatalogItems(
	admin: SupabaseClient,
	organizationId: string
): Promise<PublicCatalogItem[]> {
	const { data, error } = await admin
		.from('catalog_items')
		.select(PUBLIC_ITEM_COLUMNS)
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.order('name', { ascending: true });

	if (error || !data) {
		return [];
	}

	const rows = data as PublicCatalogItemRow[];
	if (rows.length === 0) {
		return [];
	}
	const itemIds = rows.map((row) => row.id);

	// Batched, not one query per item — same "avoid N+1 on the list
	// endpoint" rule public-resources.ts already established.
	const [stockResult, imagesResult] = await Promise.all([
		admin.from('catalog_item_stock').select('item_id, size, quantity').in('item_id', itemIds),
		admin
			.from('catalog_item_images')
			.select('id, item_id, storage_path, is_primary')
			.in('item_id', itemIds)
	]);

	const stockByItem = new Map<string, StockRow[]>();
	for (const row of (stockResult.data ?? []) as StockRow[]) {
		const existing = stockByItem.get(row.item_id);
		if (existing) existing.push(row);
		else stockByItem.set(row.item_id, [row]);
	}

	const imagesByItem = new Map<string, PublicCatalogImage[]>();
	for (const row of (imagesResult.data ?? []) as ImageRow[]) {
		const image = toPublicImage(admin, row);
		const existing = imagesByItem.get(row.item_id);
		if (existing) existing.push(image);
		else imagesByItem.set(row.item_id, [image]);
	}

	return rows.map((row) =>
		toPublicCatalogItem(row, stockByItem.get(row.id) ?? [], imagesByItem.get(row.id) ?? [])
	);
}

// A draft/archived item — or one belonging to a different organization than
// the one resolved from the URL's slug — returns null the same way a
// nonexistent id would, same visibility rule as public-resources.ts.
export async function getPublishedCatalogItem(
	admin: SupabaseClient,
	organizationId: string,
	id: string
): Promise<PublicCatalogItem | null> {
	const { data, error } = await admin
		.from('catalog_items')
		.select(PUBLIC_ITEM_COLUMNS)
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.eq('id', id)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	const [stockResult, imagesResult] = await Promise.all([
		admin.from('catalog_item_stock').select('item_id, size, quantity').eq('item_id', id),
		admin
			.from('catalog_item_images')
			.select('id, item_id, storage_path, is_primary')
			.eq('item_id', id)
	]);

	const stockRows = (stockResult.data ?? []) as StockRow[];
	const images = ((imagesResult.data ?? []) as ImageRow[]).map((row) => toPublicImage(admin, row));

	return toPublicCatalogItem(data as PublicCatalogItemRow, stockRows, images);
}
