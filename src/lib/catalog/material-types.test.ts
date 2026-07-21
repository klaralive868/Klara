import { describe, expect, it } from 'vitest';
import {
	COMMON_MATERIAL_TYPES,
	GENDERED_SIZES,
	MATERIAL_TYPES,
	MORE_MATERIAL_TYPES,
	STANDARD_BOTTOM_SIZES,
	STANDARD_TOP_SIZES,
	getMaterialType,
	sizesForScheme,
	type SizingScheme
} from './material-types';

const VALID_SCHEMES: SizingScheme[] = ['none', 'standardTops', 'standardBottoms', 'gendered'];

describe('MATERIAL_TYPES', () => {
	it('has 12 entries', () => {
		expect(MATERIAL_TYPES).toHaveLength(12);
	});

	it('every entry has a valid sizing scheme', () => {
		for (const type of MATERIAL_TYPES) {
			expect(VALID_SCHEMES).toContain(type.sizingScheme);
		}
	});

	it('every entry has a unique key', () => {
		const keys = MATERIAL_TYPES.map((type) => type.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('the common set is a subset of the full registry', () => {
		for (const type of COMMON_MATERIAL_TYPES) {
			expect(MATERIAL_TYPES).toContainEqual(type);
		}
	});

	it('common and "more" sets are disjoint and together cover the registry', () => {
		expect(COMMON_MATERIAL_TYPES.length + MORE_MATERIAL_TYPES.length).toBe(MATERIAL_TYPES.length);
		const commonKeys = new Set(COMMON_MATERIAL_TYPES.map((type) => type.key));
		for (const type of MORE_MATERIAL_TYPES) {
			expect(commonKeys.has(type.key)).toBe(false);
		}
	});

	it('every gendered-scheme type resolves to no plain sizesForScheme list (sizes come from GENDERED_SIZES instead)', () => {
		for (const type of MATERIAL_TYPES.filter((t) => t.sizingScheme === 'gendered')) {
			expect(sizesForScheme(type.sizingScheme)).toEqual([]);
		}
	});
});

describe('sizesForScheme', () => {
	it('returns the standard top sizes for standardTops', () => {
		expect(sizesForScheme('standardTops')).toBe(STANDARD_TOP_SIZES);
	});

	it('returns the standard bottom sizes for standardBottoms', () => {
		expect(sizesForScheme('standardBottoms')).toBe(STANDARD_BOTTOM_SIZES);
	});

	it('returns an empty list for none', () => {
		expect(sizesForScheme('none')).toEqual([]);
	});
});

describe('GENDERED_SIZES', () => {
	it('declares both a male and female size list, each non-empty', () => {
		expect(GENDERED_SIZES.male.length).toBeGreaterThan(0);
		expect(GENDERED_SIZES.female.length).toBeGreaterThan(0);
	});
});

describe('getMaterialType', () => {
	it('finds a known type by key', () => {
		expect(getMaterialType('shoes')?.label).toBe('Shoes');
	});

	it('returns undefined for an unknown key', () => {
		expect(getMaterialType('not-a-real-type')).toBeUndefined();
	});
});
