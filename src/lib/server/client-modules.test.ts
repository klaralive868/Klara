import { describe, expect, it } from 'vitest';
import { parseModuleAssignmentForm } from './client-modules';

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
