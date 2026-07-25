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
				ownerEmail: 'keagan@example.com',
				slug: 'netbreakerz'
			})
		);
		expect(result).toEqual({
			ok: true,
			value: {
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: 'netbreakerz'
			}
		});
	});

	it('trims whitespace from every field', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: '  Netbreakerz  ',
				ownerFullName: '  Keagan Smith  ',
				ownerEmail: '  keagan@example.com  ',
				slug: '  netbreakerz  '
			})
		);
		expect(result.ok && result.value).toEqual({
			businessName: 'Netbreakerz',
			ownerFullName: 'Keagan Smith',
			ownerEmail: 'keagan@example.com',
			slug: 'netbreakerz'
		});
	});

	it('rejects a blank business name', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: '  ',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: 'netbreakerz'
			})
		);
		expect(result).toEqual({ ok: false, message: 'Enter a business name.' });
	});

	it('rejects a blank owner name', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: '  ',
				ownerEmail: 'keagan@example.com',
				slug: 'netbreakerz'
			})
		);
		expect(result).toEqual({ ok: false, message: "Enter the owner's full name." });
	});

	it('rejects a blank owner email', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: '',
				slug: 'netbreakerz'
			})
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid owner email.' });
	});

	it('rejects a malformed owner email', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'not-an-email',
				slug: 'netbreakerz'
			})
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid owner email.' });
	});

	it('rejects a blank slug', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: '  '
			})
		);
		expect(result).toEqual({ ok: false, message: 'Enter a URL slug.' });
	});

	it('rejects a slug with uppercase characters', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: 'Netbreakerz'
			})
		);
		expect(result).toEqual({
			ok: false,
			message: 'URL slug can only contain lowercase letters, numbers, and single hyphens between them.'
		});
	});

	it('rejects a slug with spaces', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: 'net breakerz'
			})
		);
		expect(result).toEqual({
			ok: false,
			message: 'URL slug can only contain lowercase letters, numbers, and single hyphens between them.'
		});
	});

	it('rejects a slug with a leading or trailing hyphen', () => {
		const result = parseCreateClientForm(
			formData({
				businessName: 'Netbreakerz',
				ownerFullName: 'Keagan Smith',
				ownerEmail: 'keagan@example.com',
				slug: '-netbreakerz-'
			})
		);
		expect(result).toEqual({
			ok: false,
			message: 'URL slug can only contain lowercase letters, numbers, and single hyphens between them.'
		});
	});
});
