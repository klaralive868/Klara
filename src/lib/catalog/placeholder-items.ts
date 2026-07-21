// Placeholder data for the static-UI Catalog item list + form shell (ticket 1
// of #11). Replaced by real Supabase-backed data in the wire-logic ticket.

export type CatalogItemStatus = 'draft' | 'published' | 'archived';

export interface PlaceholderCatalogItem {
	id: string;
	name: string;
	description: string;
	priceCents: number;
	materialType: string;
	status: CatalogItemStatus;
	sizes: string[];
}

export const PLACEHOLDER_ITEMS: readonly PlaceholderCatalogItem[] = [
	{
		id: '1',
		name: 'Home Jersey',
		description: 'Official home jersey, breathable mesh fabric.',
		priceCents: 6500,
		materialType: 'jersey',
		status: 'published',
		sizes: ['S', 'M', 'L']
	},
	{
		id: '2',
		name: 'Court Shoes',
		description: 'Low-top court shoes with grip sole.',
		priceCents: 12000,
		materialType: 'shoes',
		status: 'draft',
		sizes: ['Male 9', 'Male 10', 'Female 7']
	},
	{
		id: '3',
		name: 'Classic Sunglasses',
		description: 'UV-protective everyday sunglasses.',
		priceCents: 3500,
		materialType: 'sunglasses',
		status: 'archived',
		sizes: []
	}
];

export function getPlaceholderItem(id: string): PlaceholderCatalogItem | undefined {
	return PLACEHOLDER_ITEMS.find((item) => item.id === id);
}
