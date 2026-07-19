# ADR-0003: Operator identity is a standalone table, not a role value

- Status: Accepted
- Date: 2026-07-18

## Context

The operator (platform admin) needs an Admin portal, reachable from a dropdown on their own Client portal dashboard where they test modules as they're built. Standards §2 requires admin/privileged actions to have an explicit, server-side operator-role check — never inferred from the frontend.

## Decision

Operator identity is tracked in a standalone `operators` table (`user_id`, `created_at`), independent of `organization_members`. A user can simultaneously hold an `organization_members` row (e.g. `owner` of their own test business) and an `operators` row — the two are orthogonal.

The Admin portal lives under its own `(admin)` route group with its own server-side guard in `hooks.server.ts`, checking `operators` directly. This guard runs independently of, and in addition to, the `(protected)` client-portal guard. A non-operator hitting an `/admin` route while otherwise authenticated is silently redirected to `/dashboard` — no error message, since Standards' intent is to avoid confirming/revealing access boundaries unnecessarily.

## Considered Options

- **Overload `organization_members.role`** with an `operator` value. Rejected: conflates "role within a business" with "is the platform operator" in a single enum, muddying a field that Standards treats as a whitelisted, per-business role — and would make an operator's business-membership role ambiguous (operator _of what_?).

## Consequences

- The first operator row (and the first business/owner membership row) has no invite flow to bootstrap from — created manually via SQL/Supabase dashboard as a one-time step, not via app code (consistent with the "closed, operator-provisioned model" in the Architecture Brief).
- Any future admin/privileged check follows the same pattern: explicit server-side lookup against `operators`, never inferred from a frontend dropdown or client-supplied flag.
