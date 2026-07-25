import { parseDollarsToCents } from '$lib/parse-dollars';

export interface ParsedResourceForm {
	name: string;
	description: string | null;
	departureDate: string;
	returnDate: string;
	priceCents: number;
	quantity: number | null;
	requiresManualConfirmation: boolean;
}

export type ParseResourceFormResult =
	{ ok: true; value: ParsedResourceForm } | { ok: false; message: string };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseResourceForm(formData: FormData): ParseResourceFormResult {
	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const departureDate = String(formData.get('departureDate') ?? '').trim();
	const returnDate = String(formData.get('returnDate') ?? '').trim();
	const priceRaw = String(formData.get('price') ?? '').trim();
	const hasCapacity = String(formData.get('hasCapacity') ?? '') === 'true';
	const quantityRaw = String(formData.get('quantity') ?? '').trim();
	const requiresManualConfirmation =
		String(formData.get('requiresManualConfirmation') ?? '') === 'true';

	if (!name) {
		return { ok: false, message: 'Enter a name for the resource.' };
	}

	if (!ISO_DATE_PATTERN.test(departureDate)) {
		return { ok: false, message: 'Enter a valid departure date.' };
	}
	if (!ISO_DATE_PATTERN.test(returnDate)) {
		return { ok: false, message: 'Enter a valid return date.' };
	}
	// Plain ISO ("YYYY-MM-DD") strings compare correctly lexicographically —
	// no need to parse into Date objects (and the timezone footguns that
	// comes with, per format-date.ts's own comment on the same issue).
	if (returnDate < departureDate) {
		return { ok: false, message: 'Return date must be on or after the departure date.' };
	}

	const priceCents = parseDollarsToCents(priceRaw);
	if (priceCents === null) {
		return { ok: false, message: 'Enter a valid price.' };
	}

	// Capacity is optional — "uncapped" (quantity: null) is a first-class
	// state, not just an empty field (Standards §4 / ADR: a package with no
	// hard limit is never auto-rejected for being "full"). The quantity
	// field is only consulted at all when hasCapacity is checked.
	let quantity: number | null = null;
	if (hasCapacity) {
		if (!/^\d+$/.test(quantityRaw)) {
			return { ok: false, message: 'Enter a valid seat limit.' };
		}
		quantity = Number(quantityRaw);
		if (quantity <= 0) {
			return { ok: false, message: 'Seat limit must be greater than zero.' };
		}
	}

	return {
		ok: true,
		value: {
			name,
			description: description || null,
			departureDate,
			returnDate,
			priceCents,
			quantity,
			requiresManualConfirmation
		}
	};
}
