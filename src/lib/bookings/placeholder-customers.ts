// Placeholder customer data for the Bookings module's static-UI "log a
// booking" form (#41) — a small local list to search/select-or-create
// against. Distinct from the real Customers module (which is already
// wired to Supabase); this list exists only so the picker has something to
// filter until the wire-logic ticket connects it to the real customers
// table.

export interface PlaceholderCustomer {
	id: string;
	fullName: string;
	email: string;
	phone: string;
}

export const PLACEHOLDER_CUSTOMERS: readonly PlaceholderCustomer[] = [
	{ id: '1', fullName: 'Jane Doe', email: 'jane@example.com', phone: '555-0101' },
	{ id: '2', fullName: 'John Smith', email: 'john@example.com', phone: '555-0102' },
	{ id: '3', fullName: 'Priya Patel', email: 'priya@example.com', phone: '555-0103' }
];
