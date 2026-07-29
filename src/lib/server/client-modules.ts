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

export interface ClientModuleDiff {
	toInsert: ClientModuleAssignment[];
	toUpdate: ClientModuleAssignment[];
	toDelete: ClientModule[];
}

// Pure set-diff so the actual DB-touching action is a thin wrapper: a module
// present in `desired` but not `current` is a new row; present in both but
// with a changed tier is an update (only `catalog` can actually differ
// today, but this isn't module-specific); present in `current` but not
// `desired` means the admin unchecked it, so the row is dropped.
export function diffClientModules(
	current: ClientModuleAssignment[],
	desired: ClientModuleAssignment[]
): ClientModuleDiff {
	const currentByModule = new Map(current.map((row) => [row.module, row.tier]));
	const desiredByModule = new Map(desired.map((row) => [row.module, row.tier]));

	const toInsert: ClientModuleAssignment[] = [];
	const toUpdate: ClientModuleAssignment[] = [];
	for (const [module, tier] of desiredByModule) {
		const currentTier = currentByModule.get(module);
		if (currentTier === undefined) {
			toInsert.push({ module, tier });
		} else if (currentTier !== tier) {
			toUpdate.push({ module, tier });
		}
	}

	const toDelete: ClientModule[] = [];
	for (const module of currentByModule.keys()) {
		if (!desiredByModule.has(module)) {
			toDelete.push(module);
		}
	}

	return { toInsert, toUpdate, toDelete };
}
