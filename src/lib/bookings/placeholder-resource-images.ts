// Placeholder data shape for the static-UI resource image upload screen
// (#39). Replaced by real Supabase Storage-backed data in the wire-logic
// ticket (#40) — mirrors Catalog's real CatalogItemImage shape
// (src/lib/catalog/types.ts) so the eventual real version is a drop-in,
// not a redesign.
export interface PlaceholderResourceImage {
	id: string;
	isPrimary: boolean;
	url: string;
}
