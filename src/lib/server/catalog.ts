import { getMaterialType } from '$lib/catalog/material-types';
import { parseDollarsToCents } from '$lib/parse-dollars';

export interface ParsedCatalogItemForm {
	name: string;
	description: string | null;
	priceCents: number;
	materialType: string;
	unlimitedStock: boolean;
}

export type ParseCatalogItemFormResult =
	{ ok: true; value: ParsedCatalogItemForm } | { ok: false; message: string };

export function parseCatalogItemForm(formData: FormData): ParseCatalogItemFormResult {
	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const priceRaw = String(formData.get('price') ?? '').trim();
	const materialType = String(formData.get('materialType') ?? '').trim();
	const unlimitedStock = String(formData.get('unlimitedStock') ?? '') === 'true';

	if (!name) {
		return { ok: false, message: 'Enter a name for the item.' };
	}

	if (!getMaterialType(materialType)) {
		return { ok: false, message: 'Select a valid material type.' };
	}

	const priceCents = parseDollarsToCents(priceRaw);
	if (priceCents === null) {
		return { ok: false, message: 'Enter a valid price.' };
	}

	return {
		ok: true,
		value: {
			name,
			description: description || null,
			priceCents,
			materialType,
			unlimitedStock
		}
	};
}

export interface StockEntry {
	size: string | null;
	quantity: number;
}

// Parses the hidden `stockQuantities` field (a JSON-serialized
// Record<string, number>, submitted by StockSelector's bind — see
// CatalogItemForm) into the entry list sync_catalog_item_stock expects. The
// "quantity" key stands in for the single sizeless-item quantity (matches
// StockSelector's own key convention) and maps to a null size. Returns an
// empty array for missing/malformed input rather than failing the whole
// form submission over a field the user never directly edits as text.
export function parseStockQuantities(raw: string | null): StockEntry[] {
	if (!raw) {
		return [];
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return [];
	}

	const entries: StockEntry[] = [];
	for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
		const quantity = Number(value);
		// <= 0, not < 0: zero-quantity entries are dropped by
		// sync_catalog_item_stock's own WHERE quantity > 0 anyway (a
		// zero-stock size doesn't need a persisted row) — filtering them out
		// here too avoids a pointless round trip for something the RPC would
		// just discard.
		if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
			continue;
		}
		entries.push({ size: key === 'quantity' ? null : key, quantity });
	}
	return entries;
}
