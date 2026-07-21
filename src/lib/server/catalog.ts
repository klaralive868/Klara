import { getMaterialType } from '$lib/catalog/material-types';

export interface ParsedCatalogItemForm {
	name: string;
	description: string | null;
	priceCents: number;
	materialType: string;
}

export type ParseCatalogItemFormResult =
	{ ok: true; value: ParsedCatalogItemForm } | { ok: false; message: string };

// Parses a non-negative decimal dollar string into integer cents entirely in
// string/integer space. Floating-point multiplication (Math.round(dollars *
// 100), even routed through toFixed first) misrounds a real class of values
// — e.g. 1.005 * 100 === 100.49999999999999 in IEEE 754 — because the error
// is reintroduced by the multiplication itself, not fixable by how the input
// was parsed. Returns null for anything that isn't a plain non-negative
// decimal (no sign, no exponent notation).
function parseDollarsToCents(raw: string): number | null {
	if (!/^\d+(\.\d+)?$/.test(raw)) {
		return null;
	}

	const [wholePart, fractionPart = ''] = raw.split('.');
	const digits = (fractionPart + '000').slice(0, 3);
	const cents = Number(wholePart) * 100 + Number(digits.slice(0, 2));
	const roundUp = Number(digits[2]) >= 5 ? 1 : 0;
	return cents + roundUp;
}

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
			materialType
		}
	};
}
