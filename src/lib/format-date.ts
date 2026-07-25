const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

// Deliberately not `new Date(iso).toLocaleDateString(...)` — that parses a
// plain "YYYY-MM-DD" as UTC midnight, then renders in the browser's local
// timezone, which shifts the displayed date back a day for anyone west of
// UTC. A calendar date isn't an instant — read the parts directly instead
// of going through any timezone conversion.
export function formatIsoDate(iso: string): string {
	const [, month, day] = iso.split('-');
	return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
	return `${formatIsoDate(startIso)} – ${formatIsoDate(endIso)}`;
}
