// Static, code-owned Material Type registry (clothing vertical). See
// docs/adr/0004-catalog-categories-client-authored.md for why this — unlike
// Categories — is not client-authored, and CONTEXT.md's "Material Type" entry.

export type SizingScheme = 'none' | 'standardTops' | 'standardBottoms' | 'gendered';

export interface MaterialType {
	key: string;
	label: string;
	sizingScheme: SizingScheme;
	/** Shown in the picker's default view rather than behind "+ More materials". */
	isCommon: boolean;
	/** Gendered sizing (e.g. Shoes) needs separate male/female size arrays. */
	hasGenderVariant: boolean;
}

export const STANDARD_TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
export const STANDARD_BOTTOM_SIZES = ['28', '30', '32', '34', '36', '38', '40'] as const;
export const GENDERED_SIZES = {
	male: ['7', '8', '9', '10', '11', '12', '13'],
	female: ['5', '6', '7', '8', '9', '10']
} as const;

export const MATERIAL_TYPES: readonly MaterialType[] = [
	{
		key: 'jersey',
		label: 'Jersey',
		sizingScheme: 'standardTops',
		isCommon: true,
		hasGenderVariant: false
	},
	{
		key: 'shirt',
		label: 'Shirt',
		sizingScheme: 'standardTops',
		isCommon: true,
		hasGenderVariant: false
	},
	{
		key: 'shorts',
		label: 'Shorts',
		sizingScheme: 'standardBottoms',
		isCommon: true,
		hasGenderVariant: false
	},
	{
		key: 'shoes',
		label: 'Shoes',
		sizingScheme: 'gendered',
		isCommon: true,
		hasGenderVariant: true
	},
	{
		key: 'jeans',
		label: 'Jeans',
		sizingScheme: 'standardBottoms',
		isCommon: true,
		hasGenderVariant: false
	},
	{
		key: 'skirt',
		label: 'Skirt',
		sizingScheme: 'standardBottoms',
		isCommon: false,
		hasGenderVariant: false
	},
	{
		key: 'dress',
		label: 'Dress',
		sizingScheme: 'standardTops',
		isCommon: false,
		hasGenderVariant: false
	},
	{
		key: 'belt',
		label: 'Belt',
		sizingScheme: 'standardBottoms',
		isCommon: false,
		hasGenderVariant: false
	},
	{ key: 'socks', label: 'Socks', sizingScheme: 'none', isCommon: false, hasGenderVariant: false },
	{
		key: 'underwear',
		label: 'Underwear',
		sizingScheme: 'standardTops',
		isCommon: false,
		hasGenderVariant: false
	},
	{
		key: 'sunglasses',
		label: 'Sunglasses',
		sizingScheme: 'none',
		isCommon: false,
		hasGenderVariant: false
	},
	{
		key: 'slides',
		label: 'Slides',
		sizingScheme: 'gendered',
		isCommon: false,
		hasGenderVariant: true
	}
];

export const COMMON_MATERIAL_TYPES = MATERIAL_TYPES.filter((type) => type.isCommon);
export const MORE_MATERIAL_TYPES = MATERIAL_TYPES.filter((type) => !type.isCommon);

export function getMaterialType(key: string): MaterialType | undefined {
	return MATERIAL_TYPES.find((type) => type.key === key);
}

export function sizesForScheme(scheme: SizingScheme): readonly string[] {
	switch (scheme) {
		case 'standardTops':
			return STANDARD_TOP_SIZES;
		case 'standardBottoms':
			return STANDARD_BOTTOM_SIZES;
		case 'none':
		case 'gendered':
			return [];
	}
}
