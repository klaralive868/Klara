// Placeholder data for the static-UI Travel Inquiries inbox + manual
// inquiry creation form (#45). Replaced by real Supabase-backed data in
// the wire-logic ticket (#48). Domain term "Travel Inquiry" per
// docs/bookings-travel-packages-spec.md — upstream of and structurally
// separate from Resources/Bookings; a customer's request for the agent to
// design a custom trip with no existing package to book against.

export type TravelInquiryStatus = 'new' | 'in-progress' | 'converted' | 'closed';

export interface PlaceholderTravelInquiry {
	id: string;
	customerName: string;
	customerEmail: string;
	tripDescription: string;
	preferredDates: string;
	partySize: number | null;
	budget: string;
	notes: string;
	status: TravelInquiryStatus;
}

export const PLACEHOLDER_INQUIRIES: readonly PlaceholderTravelInquiry[] = [
	{
		id: '1',
		customerName: 'Jane Doe',
		customerEmail: 'jane@example.com',
		tripDescription: 'A custom honeymoon somewhere in the Mediterranean — Greece or Italy.',
		preferredDates: 'Sometime in September 2026, 10-12 days',
		partySize: 2,
		budget: '$8,000–$10,000',
		notes: 'Prefers boutique hotels over resorts.',
		status: 'new'
	},
	{
		id: '2',
		customerName: 'John Smith',
		customerEmail: 'john@example.com',
		tripDescription: 'Multi-generational family trip to Japan — grandparents plus two kids.',
		preferredDates: 'Spring break 2027, flexible by a week either way',
		partySize: 6,
		budget: 'Around $25,000 total',
		notes: 'Need accessible accommodation for one grandparent.',
		status: 'in-progress'
	},
	{
		id: '3',
		customerName: 'Priya Patel',
		customerEmail: 'priya@example.com',
		tripDescription: 'Solo backpacking trip through Southeast Asia.',
		preferredDates: 'Open-ended, 6-8 weeks starting January 2027',
		partySize: 1,
		budget: 'Budget traveler, ~$3,000',
		notes: '',
		status: 'converted'
	},
	{
		id: '4',
		customerName: 'John Smith',
		customerEmail: 'john@example.com',
		tripDescription: 'Ski trip to the Alps.',
		preferredDates: 'Feb 2027',
		partySize: 4,
		budget: '',
		notes: 'Went with a different agency after we were slow to respond.',
		status: 'closed'
	}
];

export function getPlaceholderInquiry(id: string): PlaceholderTravelInquiry | undefined {
	return PLACEHOLDER_INQUIRIES.find((inquiry) => inquiry.id === id);
}

export function travelInquiryStatusVariant(status: TravelInquiryStatus) {
	if (status === 'in-progress') return 'default';
	if (status === 'converted') return 'secondary';
	if (status === 'closed') return 'destructive';
	return 'outline';
}
