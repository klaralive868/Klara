import { describe, expect, it } from 'vitest';
import { diffClientModules, parseModuleAssignmentForm } from './client-modules';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

describe('parseModuleAssignmentForm', () => {
	it('includes only checked modules', () => {
		const result = parseModuleAssignmentForm(
			formData({
				catalog: 'false',
				bookings: 'true',
				resources: 'false',
				inquiries: 'true',
				catalogTier: 'clothing'
			})
		);
		expect(result.ok && result.value).toEqual([
			{ module: 'bookings', tier: 'standard' },
			{ module: 'inquiries', tier: 'standard' }
		]);
	});

	it('returns an empty list when nothing is checked', () => {
		const result = parseModuleAssignmentForm(formData({}));
		expect(result).toEqual({ ok: true, value: [] });
	});

	it('requires a tier when catalog is checked', () => {
		const result = parseModuleAssignmentForm(formData({ catalog: 'true' }));
		expect(result).toEqual({ ok: false, message: 'Select a catalog tier.' });
	});

	it('uses the given tier when catalog is checked with one', () => {
		const result = parseModuleAssignmentForm(
			formData({ catalog: 'true', catalogTier: 'clothing' })
		);
		expect(result).toEqual({ ok: true, value: [{ module: 'catalog', tier: 'clothing' }] });
	});
});

describe('diffClientModules', () => {
	it('inserts a newly checked module', () => {
		const diff = diffClientModules([], [{ module: 'bookings', tier: 'standard' }]);
		expect(diff).toEqual({
			toInsert: [{ module: 'bookings', tier: 'standard' }],
			toUpdate: [],
			toDelete: []
		});
	});

	it('deletes an unchecked module', () => {
		const diff = diffClientModules([{ module: 'bookings', tier: 'standard' }], []);
		expect(diff).toEqual({ toInsert: [], toUpdate: [], toDelete: ['bookings'] });
	});

	it('updates tier when it changed', () => {
		const diff = diffClientModules(
			[{ module: 'catalog', tier: 'clothing' }],
			[{ module: 'catalog', tier: 'electronics' }]
		);
		expect(diff).toEqual({
			toInsert: [],
			toUpdate: [{ module: 'catalog', tier: 'electronics' }],
			toDelete: []
		});
	});

	it('leaves an unchanged module alone', () => {
		const diff = diffClientModules(
			[{ module: 'catalog', tier: 'clothing' }],
			[{ module: 'catalog', tier: 'clothing' }]
		);
		expect(diff).toEqual({ toInsert: [], toUpdate: [], toDelete: [] });
	});
});
