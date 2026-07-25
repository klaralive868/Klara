// Parses a non-negative decimal dollar string into integer cents entirely in
// string/integer space. Floating-point multiplication (Math.round(dollars *
// 100), even routed through toFixed first) misrounds a real class of values
// — e.g. 1.005 * 100 === 100.49999999999999 in IEEE 754 — because the error
// is reintroduced by the multiplication itself, not fixable by how the input
// was parsed. Returns null for anything that isn't a plain non-negative
// decimal (no sign, no exponent notation).
export function parseDollarsToCents(raw: string): number | null {
	if (!/^\d+(\.\d+)?$/.test(raw)) {
		return null;
	}

	const [wholePart, fractionPart = ''] = raw.split('.');
	const digits = (fractionPart + '000').slice(0, 3);
	const cents = Number(wholePart) * 100 + Number(digits.slice(0, 2));
	const roundUp = Number(digits[2]) >= 5 ? 1 : 0;
	return cents + roundUp;
}
