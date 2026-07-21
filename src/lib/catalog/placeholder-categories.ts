// Placeholder data for the static-UI category management screen + item
// tagger (ticket 3 of #11). Categories are client-authored (ADR-0004) and
// exactly two levels deep — a category with a non-null parentId may not
// itself be a parent. Replaced by real Supabase-backed data in the
// wire-logic ticket (#17).

export interface PlaceholderCategory {
	id: string;
	name: string;
	parentId: string | null;
}

export const PLACEHOLDER_CATEGORIES: readonly PlaceholderCategory[] = [
	{ id: 'male', name: 'Male', parentId: null },
	{ id: 'female', name: 'Female', parentId: null },
	{ id: 'kids', name: 'Kids', parentId: null },
	{ id: 'kids-jerseys', name: 'Jerseys', parentId: 'kids' },
	{ id: 'male-shoes', name: 'Shoes', parentId: 'male' }
];
