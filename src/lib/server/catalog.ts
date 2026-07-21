import { getMaterialType } from '$lib/catalog/material-types';

export interface ParsedCatalogItemForm {
	name: string;
	description: string | null;
	priceCents: number;
	materialType: string;
}

export type ParseCatalogItemFormResult =
	{ ok: true; value: ParsedCatalogItemForm } | { ok: false; message: string };

export function parseCatalogItemForm(formData: FormData): ParseCatalogItemFormResult {
	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const priceRaw = String(formData.get('price') ?? '').trim();
	const materialType = String(formData.get('materialType') ?? '').trim();

	if (!name) {
		return { ok: false, message: 'Enter a name for the item.' };
	}

	if (!getMaterialType(materialType)) {
		return { ok: false, message: 'Select a valid material type.' };
	}

	const priceDollars = Number(priceRaw);
	if (!Number.isFinite(priceDollars) || priceDollars < 0) {
		return { ok: false, message: 'Enter a valid price.' };
	}

	return {
		ok: true,
		value: {
			name,
			description: description || null,
			priceCents: Math.round(priceDollars * 100),
			materialType
		}
	};
}
