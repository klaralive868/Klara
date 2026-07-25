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

// PostgreSQL's `integer` columns (price_cents, quantity) are 32-bit signed —
// values beyond this would otherwise reach the DB and fail as a generic
// server error instead of a field validation message.
const PG_INTEGER_MAX = 2147483647;

// The regex only checks shape ("digits-digits-digits") — it accepts
// calendar-invalid dates like 2026-02-30, which `new Date(...)` silently
// rolls over into a different date rather than rejecting (2026-02-30 becomes
// 2026-03-02). Re-deriving the parts from the parsed Date and comparing them
// back against the input catches that rollover.
function isValidIsoDate(raw: string): boolean {
	if (!ISO_DATE_PATTERN.test(raw)) {
		return false;
	}
	const [year, month, day] = raw.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

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

	if (!isValidIsoDate(departureDate)) {
		return { ok: false, message: 'Enter a valid departure date.' };
	}
	if (!isValidIsoDate(returnDate)) {
		return { ok: false, message: 'Enter a valid return date.' };
	}
	// Plain ISO ("YYYY-MM-DD") strings compare correctly lexicographically —
	// no need to parse into Date objects (and the timezone footguns that
	// comes with, per format-date.ts's own comment on the same issue).
	if (returnDate < departureDate) {
		return { ok: false, message: 'Return date must be on or after the departure date.' };
	}

	const priceCents = parseDollarsToCents(priceRaw);
	if (priceCents === null || priceCents > PG_INTEGER_MAX) {
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
		if (quantity > PG_INTEGER_MAX) {
			return { ok: false, message: 'Seat limit is too large.' };
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
