// Placeholder data for the static-UI Bookings inbox + manual booking
// creation form (#41). Replaced by real Supabase-backed data in the
// wire-logic ticket (#44). Domain term "Booking" per
// docs/bookings-travel-packages-spec.md — always created 'pending', never
// auto-confirmed.

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface PlaceholderBooking {
	id: string;
	resourceId: string;
	resourceName: string;
	customerName: string;
	customerEmail: string;
	travelerCount: number;
	notes: string;
	status: BookingStatus;
	departureDate: string;
	returnDate: string;
}

export const PLACEHOLDER_BOOKINGS: readonly PlaceholderBooking[] = [
	{
		id: '1',
		resourceId: '1',
		resourceName: 'Bali 7-Day Tour — Aug 12 Departure',
		customerName: 'Jane Doe',
		customerEmail: 'jane@example.com',
		travelerCount: 2,
		notes: 'Anniversary trip — requested a sea-view room if possible.',
		status: 'pending',
		departureDate: '2026-08-12',
		returnDate: '2026-08-19'
	},
	{
		id: '2',
		resourceId: '1',
		resourceName: 'Bali 7-Day Tour — Aug 12 Departure',
		customerName: 'John Smith',
		customerEmail: 'john@example.com',
		travelerCount: 1,
		notes: '',
		status: 'confirmed',
		departureDate: '2026-08-12',
		returnDate: '2026-08-19'
	},
	{
		id: '3',
		resourceId: '3',
		resourceName: 'European Highlights — Oct 1 Departure',
		customerName: 'Priya Patel',
		customerEmail: 'priya@example.com',
		travelerCount: 4,
		notes: 'Traveling with two children, need connecting rooms.',
		status: 'completed',
		departureDate: '2026-10-01',
		returnDate: '2026-10-11'
	},
	{
		id: '4',
		resourceId: '2',
		resourceName: 'Bali 7-Day Tour — Sept 3 Departure',
		customerName: 'John Smith',
		customerEmail: 'john@example.com',
		travelerCount: 3,
		notes: 'Requested full refund after a schedule conflict.',
		status: 'cancelled',
		departureDate: '2026-09-03',
		returnDate: '2026-09-10'
	}
];

export function getPlaceholderBooking(id: string): PlaceholderBooking | undefined {
	return PLACEHOLDER_BOOKINGS.find((booking) => booking.id === id);
}

export function bookingStatusVariant(status: BookingStatus) {
	if (status === 'confirmed') return 'default';
	if (status === 'completed') return 'secondary';
	if (status === 'cancelled') return 'destructive';
	return 'outline';
}
