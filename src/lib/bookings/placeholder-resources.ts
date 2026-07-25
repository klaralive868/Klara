// Placeholder data for the static-UI Resource list + form shell (ticket #37
// of #35). Replaced by real Supabase-backed data in the wire-logic ticket
// (#38). Domain term "Resource" per CONTEXT.md's Bookings section.

export type ResourceStatus = 'draft' | 'published' | 'archived';

export interface PlaceholderResource {
	id: string;
	name: string;
	description: string;
	departureDate: string;
	returnDate: string;
	/** Seat capacity — null means uncapped (no limit, pure request log). */
	quantity: number | null;
	requiresManualConfirmation: boolean;
	priceCents: number;
	status: ResourceStatus;
	/**
	 * How many photos this resource has — a count, not real URLs. The
	 * public detail page (#42) renders this many placeholder image tiles;
	 * real photo upload/storage is #39/#40's job, not this ticket's.
	 */
	imageCount: number;
}

export const PLACEHOLDER_RESOURCES: readonly PlaceholderResource[] = [
	{
		id: '1',
		name: 'Bali 7-Day Tour — Aug 12 Departure',
		description: 'A week of beaches, temples, and rice terraces, flights and hotel included.',
		departureDate: '2026-08-12',
		returnDate: '2026-08-19',
		quantity: 20,
		requiresManualConfirmation: true,
		priceCents: 189900,
		status: 'published',
		imageCount: 3
	},
	{
		id: '2',
		name: 'Bali 7-Day Tour — Sept 3 Departure',
		description: 'A week of beaches, temples, and rice terraces, flights and hotel included.',
		departureDate: '2026-09-03',
		returnDate: '2026-09-10',
		quantity: null,
		requiresManualConfirmation: true,
		priceCents: 189900,
		status: 'draft',
		imageCount: 2
	},
	{
		id: '3',
		name: 'European Highlights — Oct 1 Departure',
		description: 'Paris, Rome, and Barcelona in ten days.',
		departureDate: '2026-10-01',
		returnDate: '2026-10-11',
		quantity: 12,
		requiresManualConfirmation: true,
		priceCents: 349900,
		status: 'archived',
		imageCount: 4
	},
	{
		id: '4',
		name: 'Costa Rica Adventure — Nov 5 Departure',
		description: 'Rainforest zip-lining, volcano hikes, and beach time on the Pacific coast.',
		departureDate: '2026-11-05',
		returnDate: '2026-11-12',
		quantity: null,
		requiresManualConfirmation: true,
		priceCents: 219900,
		status: 'published',
		imageCount: 5
	}
];

export function getPlaceholderResource(id: string): PlaceholderResource | undefined {
	return PLACEHOLDER_RESOURCES.find((resource) => resource.id === id);
}
