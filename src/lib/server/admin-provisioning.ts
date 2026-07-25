import { isValidSlug } from '$lib/slug';

export interface ParsedCreateClientForm {
	businessName: string;
	ownerFullName: string;
	ownerEmail: string;
	slug: string;
}

export type ParseCreateClientFormResult =
	| { ok: true; value: ParsedCreateClientForm }
	| { ok: false; message: string };

// A deliberately loose check — actual deliverability is Supabase's problem
// via inviteUserByEmail, not this form's. This only exists to reject an
// obviously-malformed address before spending an invite-email send on it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCreateClientForm(formData: FormData): ParseCreateClientFormResult {
	const businessName = String(formData.get('businessName') ?? '').trim();
	const ownerFullName = String(formData.get('ownerFullName') ?? '').trim();
	const ownerEmail = String(formData.get('ownerEmail') ?? '').trim();
	const slug = String(formData.get('slug') ?? '').trim();

	if (!businessName) {
		return { ok: false, message: 'Enter a business name.' };
	}
	if (!ownerFullName) {
		return { ok: false, message: "Enter the owner's full name." };
	}
	if (!ownerEmail || !EMAIL_PATTERN.test(ownerEmail)) {
		return { ok: false, message: "Enter a valid owner email." };
	}
	if (!slug) {
		return { ok: false, message: 'Enter a URL slug.' };
	}
	if (!isValidSlug(slug)) {
		return {
			ok: false,
			message: 'URL slug can only contain lowercase letters, numbers, and single hyphens between them.'
		};
	}

	return { ok: true, value: { businessName, ownerFullName, ownerEmail, slug } };
}
