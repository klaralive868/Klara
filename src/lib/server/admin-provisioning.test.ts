import { describe, expect, it } from 'vitest';
import { parseCreateClientForm } from './admin-provisioning';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

describe('parseCreateClientForm', () => {
	it('parses valid input', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com'
			})
		);
		expect(result).toEqual({
			ok: true,
			value: {
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com'
			}
		});
	});

	it('trims whitespace from every field', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: '  Netbreakerz  ',
				ownerFullName: '  Keagan Smith  ',
				ownerEmail: '  keagan@example.com  '
			})
		);
		expect(result.ok && result.value).toEqual({
			businessName: 'Netbreakerz',
			ownerFullName: 'Keagan Smith',
			ownerEmail: 'keagan@example.com'
		});
	});

	it('rejects a blank business name', () => {
		const result = parseCreateClientForm(
			formData({ businessName: '  ', ownerFullName: 'Keagan Smith', ownerEmail: 'keagan@example.com' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a business name.' });
	});

	it('rejects a blank owner name', () => {
		const result = parseCreateClientForm(
			formData({ businessName: 'Netbreakerz', ownerFullName: '  ', ownerEmail: 'keagan@example.com' })
		);
		expect(result).toEqual({ ok: false, message: "Enter the owner's full name." });
	});

	it('rejects a blank owner email', () => {
		const result = parseCreateClientForm(
			formData({ businessName: 'Netbreakerz', ownerFullName: 'Keagan Smith', ownerEmail: '' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid owner email.' });
	});

	it('rejects a malformed owner email', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'not-an-email'
			})
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid owner email.' });
	});
});
