# Klara

Klara is a multi-tenant SaaS "digital operating system" for small businesses, giving each business a portal to manage their website, content, and operations through toggleable modules.

## Language

**Operator**:
The platform owner running Klara itself — provisions clients, assigns modules, and has access to the Admin portal. Identity tracked in a standalone `operators` table, independent of any business's `organization_members`. Not a role within a business.
_Avoid_: Admin (ambiguous with "admin portal" and with a business's own `manager`/`owner` roles), superuser.

**Client portal**:
The surface a business uses to manage their own content, customers, and operations. Guarded by the `(protected)` route group.
_Avoid_: Dashboard (that's a specific route within the client portal, not the surface itself), app.

**Admin portal**:
The surface the Operator uses to manage all clients — provisioning, module assignment, read-only support access to a client's dashboard. Guarded by the `(admin)` route group, independent of the client portal's guard.
_Avoid_: Backend, ops panel.

**Membership**:
An `organization_members` row linking a user to a business with a fixed `role` (owner/manager/staff) and a `status` (`pending` | `active`). Created at invite time with `status: pending`; flipped to `active` (with `claimed_at` set) when the invite is claimed.
_Avoid_: Account (a user may hold zero, one, or more memberships; "account" conflates the two).

**Claim**:
The act of an invited user completing the invite-link flow: exchanging Supabase's invite token for a session, then setting a password. Single-use — a claimed link revisited must show "already claimed, please sign in," never re-process silently.
_Avoid_: Activate, accept (reserve "activate" for the resulting `status: active`, not the act itself).
