import { describe, expect, it } from 'vitest';
import { parseCatalogItemForm, parseStockQuantities } from './catalog';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

describe('parseCatalogItemForm', () => {
	it('parses valid input, converting dollars to integer cents', () => {
		const result = parseCatalogItemForm(
			formData({
				name: 'Home Jersey',
				description: 'Mesh fabric',
				price: '65.00',
				materialType: 'jersey'
			})
		);
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Home Jersey',
				description: 'Mesh fabric',
				priceCents: 6500,
				materialType: 'jersey',
				unlimitedStock: false
			}
		});
	});

	it('treats a blank description as null', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', description: '  ', price: '10', materialType: 'jersey' })
		);
		expect(result.ok && result.value.description).toBeNull();
	});

	it('rejects a blank name', () => {
		const result = parseCatalogItemForm(
			formData({ name: '  ', price: '10', materialType: 'jersey' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a name for the item.' });
	});

	it('defaults unlimitedStock to false when the field is absent', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '10', materialType: 'jersey' })
		);
		expect(result.ok && result.value.unlimitedStock).toBe(false);
	});

	it('parses unlimitedStock: true', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '10', materialType: 'jersey', unlimitedStock: 'true' })
		);
		expect(result.ok && result.value.unlimitedStock).toBe(true);
	});

	it('rejects an unknown material type', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '10', materialType: 'not-real' })
		);
		expect(result).toEqual({ ok: false, message: 'Select a valid material type.' });
	});

	it('rejects a negative price', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '-5', materialType: 'jersey' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid price.' });
	});

	it('rejects a non-numeric price', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: 'abc', materialType: 'jersey' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid price.' });
	});

	it('rounds fractional cents', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '9.999', materialType: 'jersey' })
		);
		expect(result.ok && result.value.priceCents).toBe(1000);
	});

	it('rounds a value that IEEE 754 float multiplication would misround (1.005 * 100 === 100.49999999999999)', () => {
		const result = parseCatalogItemForm(
			formData({ name: 'Item', price: '1.005', materialType: 'jersey' })
		);
		expect(result.ok && result.value.priceCents).toBe(101);
	});
});

describe('parseStockQuantities', () => {
	it('maps sized entries by their size key', () => {
		expect(parseStockQuantities(JSON.stringify({ M: 5, L: 3 }))).toEqual(
			expect.arrayContaining([
				{ size: 'M', quantity: 5 },
				{ size: 'L', quantity: 3 }
			])
		);
	});

	it('maps the sizeless "quantity" key to a null size', () => {
		expect(parseStockQuantities(JSON.stringify({ quantity: 7 }))).toEqual([
			{ size: null, quantity: 7 }
		]);
	});

	it('returns an empty array for null input', () => {
		expect(parseStockQuantities(null)).toEqual([]);
	});

	it('returns an empty array for malformed JSON', () => {
		expect(parseStockQuantities('not json')).toEqual([]);
	});

	it('returns an empty array for a JSON array instead of an object', () => {
		expect(parseStockQuantities('[1,2,3]')).toEqual([]);
	});

	it('drops entries with a negative, non-integer, or non-numeric quantity', () => {
		expect(parseStockQuantities(JSON.stringify({ M: -1, L: 1.5, XL: 'abc', S: 4 }))).toEqual([
			{ size: 'S', quantity: 4 }
		]);
	});

	it('drops zero-quantity entries too — sync_catalog_item_stock would discard them anyway', () => {
		expect(parseStockQuantities(JSON.stringify({ M: 0, S: 4 }))).toEqual([
			{ size: 'S', quantity: 4 }
		]);
	});
});
