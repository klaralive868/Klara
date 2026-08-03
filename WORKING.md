# Current task

Fix production bug: https://www.klara.live/dashboard/customers doesn't load — clicking "All customers" changes the URL but the page content never updates.

# Plan

- [x] Reproduce/diagnose root cause
- [x] Apply fix in DynamicFieldFilterControls.svelte
- [x] Verify fix locally (svelte-check clean, e2e reproduction test passes with no Svelte error)
- [x] Commit
- [x] Push directly to main (commit a14c5fc) — no branch protection, treated as a production hotfix
- [ ] Confirm fixed on production (klara.live) — waiting on Simmo to check after Vercel finishes deploying

# State as of last update

Root cause: `DynamicFieldFilterControls.svelte`'s `$effect.pre` pre-seeded `numberRanges`/`dateRanges` slots before first render (required because Svelte 5 forbids binding an undefined path into a `$bindable(new Set())` fallback prop), but never did the same for `select`/`multi_select`/`boolean` field types, which bind `facetValues[def.fieldKey]` the same way into `DataTableFacetedFilter`. Any org with an active select/multi_select/boolean field definition threw on render of /dashboard/customers. Fixed by extending the same pre-seed effect to cover those three field types too.

Fix is pushed to main and (per Vercel's normal setup) should auto-deploy to production. Not yet confirmed live — no direct Vercel deployment access from this session (list_deployments returned 403; the connected Vercel account doesn't have permission on the klara-app project).

# Files touched this task

- src/lib/components/field-definitions/DynamicFieldFilterControls.svelte

# Blockers / waiting on

Simmo to confirm the Customers page loads correctly on klara.live once the deploy finishes.
