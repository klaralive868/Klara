# ADR-0009: Organization deactivation gates through `current_organization_id()`, not per-route checks

- Status: Accepted
- Date: 2026-07-29

## Context

The admin portal could create client organizations (`admin/clients/new`) but had no way to shut one down, and no way to change which of the 4 dashboard modules (`catalog`, `bookings`, `resources`, `inquiries`) an organization has access to — both were explicitly deferred (`admin/clients/new/+page.server.ts`'s "module assignment is a separate, later admin action" comment). This surfaced as a concrete need: an operator has no way to deactivate WorldView (or any other real client) if that relationship ends.

Deactivation had to be reversible (a business relationship pausing, not data destruction) and had to actually lock the org's members out of the dashboard, not just cosmetically flag the org in the admin list.

## Decision

`organizations` gets a `status text not null default 'active' check (status in ('active', 'archived'))` column — the same text-column-with-check-constraint shape already used by `catalog_items`, `customers`, and `resources`, not a new `archived_at`-timestamp convention.

The enforcement point is `current_organization_id()` (`20260719035515_organization_members.sql`), not a check added to every route/policy that currently trusts it. That function already is the single reused primitive behind every org-scoped RLS policy in the schema — bookings, catalog, resources, inquiries, client_modules, and `organizations`/`organization_members` themselves. Requiring the joined `organizations.status = 'active'` inside that one function means an archived org's members lose RLS-scoped access everywhere at once, for every policy gated on `current_organization_id()`, with no other policy touched.

**One route doesn't go through that primitive, and needed an explicit fix.** The (protected) dashboard guard's `getMembershipStatus` (`src/lib/server/membership.ts`) reads a caller's own `organization_members` row by `user_id`, which is covered by `member_select_own_row` (`20260719054648`) — a deliberately permissive policy added so a *pending* invitee (no active membership yet, so `current_organization_id()` is null for them regardless) can still see their own row during claim. That policy OR-combines with every other SELECT policy on the table, so gating `current_organization_id()` alone never actually reached this query: an archived org's active member kept reading as `'active'` and sailing straight through the dashboard guard. Manual end-to-end verification (not just the RLS-level reasoning above) is what caught this — it didn't surface from code review or the unit tests alone.

The fix follows the same "additive, mirrors an existing precedent" shape as `member_select_own_row` itself: a new `organizations_select_via_own_membership` policy (`20260730020000`) lets a caller see the org behind *any* of their own membership rows (active or pending), and `getMembershipStatus` now selects the joined `organizations(status)` and requires it `'active'` before returning `'active'` — pending stays unconditional on org status, unchanged from before.

Module editing (the second gap) is a simple per-module enable/disable toggle against the existing `client_modules` table (`admin/clients/[id]`), not the fuller "featured module"/request-flow system described in the architecture brief §6 — that's still a later, separate piece of work.

## Consequences

- **Scope boundary, deliberate not accidental**: this locks out authenticated dashboard/API access for an archived org's members. It does **not** touch the public-facing storefront (`/book/[orgSlug]/...`, the inquiry form) — those resolve the organization by slug and write via the service-role client (`20260728000000_travel_inquiries_service_role_grant.sql`), bypassing RLS entirely, so `current_organization_id()` never enters into it. A client's public booking page keeps working even while their dashboard is deactivated. A follow-up ticket can add a storefront-level check if full shutdown is ever needed.
- No new RLS `update` policy was needed for either the `status` toggle or `client_modules` writes: both already only accept writes from the service-role client in admin routes (no `authenticated` insert/update/delete policy exists on `organizations` or `client_modules`), consistent with the existing closed-provisioning model.
- Reactivating an org (`status` back to `'active'`) restores access immediately with no other cleanup required, precisely because the gate lives in one function rather than scattered flags.
- An operator who also holds an ordinary membership row in the org they're deactivating loses `/dashboard` access for that membership the same as any other member — `/admin` itself is unaffected (`(admin)/+layout.server.ts` only checks `isOperator`, not org membership). Not expected to matter in practice (operators aren't ordinarily members of the client orgs they administer), but worth knowing if an operator ever is.
