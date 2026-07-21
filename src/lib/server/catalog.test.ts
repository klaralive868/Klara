import { describe, expect, it } from 'vitest';
import { parseCatalogItemForm } from './catalog';

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
				materialType: 'jersey'
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
