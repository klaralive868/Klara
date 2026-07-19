# ADR-0001: Use Supabase Auth, not Better Auth

- Status: Accepted
- Date: 2026-07-18

## Context

The v1 build used Convex + Better Auth. The Better Auth ↔ Convex integration relied on a community-maintained adapter that was the single largest source of friction and fragility in that build.

The v2 rebuild moves the data platform to Supabase (Postgres + RLS — see the Architecture Brief §5). Row Level Security policies authenticate the caller via `auth.uid()`, which reads claims out of Supabase's own JWT. Better Auth issues a differently-shaped token. Using Better Auth on top of Supabase would require a bridging/adapter layer to make Better Auth's tokens legible to `auth.uid()` — reintroducing exactly the adapter fragility that broke v1, just at a different seam.

## Decision

Klara uses **Supabase's own Auth** for all authentication. Better Auth is not used anywhere in the project.

Roles and team membership (owner/manager/staff) are **not** handled by Better Auth's organization plugin (which doesn't exist in this stack) or by any auth-library plugin. They are handled by a hand-rolled `organization_members` table: a user's role lives on their membership row. This table is the source of truth for identity/membership; RLS policies (plus views/application-layer filtering for column-level restriction) are the source of truth for what that role can actually access.

## Consequences

- RLS policies can rely directly on `auth.uid()` with no adapter/bridging layer between the auth system and the database.
- Session handling, invite-link claim, and password-set flows are built against Supabase Auth's native APIs, not wrapped or reimplemented.
- Any future doc, tool, wizard, dependency, or scaffold output that reintroduces Better Auth (or any auth library issuing non-Supabase tokens) is **drift against this decision** — flag and reconcile against this ADR before proceeding, do not follow it silently.
- Role enforcement is deliberately two-layered by design (membership table + RLS/views), not a shortcut — see Standards §3. A role existing in `organization_members` with no corresponding RLS enforcement is an incomplete implementation.

## Related

- Architecture Brief v2, §3 (Auth & entry flow), §5 (Data platform: Supabase)
- Standards v2, §1 (RLS), §3 (Auth)
