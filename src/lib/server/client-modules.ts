// The 4 modules the dashboard currently gates on (app-sidebar.svelte,
// each module's own +layout.server.ts) — the only ones an admin can assign
// today. `catalog` is the only one with a real tier registry right now
// (`'clothing'`); other modules still need a tier value in client_modules
// (not null column) so they get a fixed placeholder.
export const CLIENT_MODULES = ['catalog', 'bookings', 'resources', 'inquiries'] as const;
export type ClientModule = (typeof CLIENT_MODULES)[number];

const DEFAULT_TIER = 'standard';

export interface ClientModuleAssignment {
	module: ClientModule;
	tier: string;
}

export type ParseModuleAssignmentFormResult =
	{ ok: true; value: ClientModuleAssignment[] } | { ok: false; message: string };

// Same hidden-input-plus-bind:checked convention as ResourceForm.svelte —
// bits-ui's Checkbox doesn't submit natively, so each module ships a hidden
// "true"/"false" string field alongside it (see resources.ts's
// `hasCapacity`/`requiresManualConfirmation` parsing for the precedent).
export function parseModuleAssignmentForm(formData: FormData): ParseModuleAssignmentFormResult {
	const assignments: ClientModuleAssignment[] = [];

	for (const module of CLIENT_MODULES) {
		const checked = String(formData.get(module) ?? '') === 'true';
		if (!checked) continue;

		if (module === 'catalog') {
			const tier = String(formData.get('catalogTier') ?? '').trim();
			if (!tier) {
				return { ok: false, message: 'Select a catalog tier.' };
			}
			assignments.push({ module, tier });
		} else {
			assignments.push({ module, tier: DEFAULT_TIER });
		}
	}

	return { ok: true, value: assignments };
}
