# ADR-0002: Membership rows are created pending at invite time, not at claim time

- Status: Accepted
- Date: 2026-07-18

## Context

An invite needs to carry a role (owner/manager/staff) from the moment it's sent, and the invite-link claim flow (Standards §3, ADR-0001) needs a reliable way to tell "already claimed" apart from "invalid/expired" without parsing Supabase error internals.

## Decision

`organization_members` rows are created **at invite time**, not at claim time. The inviter picks the role when sending the invite; the row is created immediately with `status: pending`. The claim flow (after Supabase's native `inviteUserByEmail` token exchange succeeds and the user sets a password) flips `status → active` and stamps `claimed_at`.

Invite delivery itself uses Supabase Auth's native `inviteUserByEmail` (service-role, server-only) rather than a hand-rolled token/email system — this keeps the token Supabase-issued and `auth.uid()`-legible, consistent with ADR-0001's reasoning against bridging layers.

## Considered Options

- **Defer row creation to claim time**, smuggling the role through Supabase's invite `user_metadata`. Rejected: makes pending invites (and their roles) unqueryable/unauditable before anyone clicks the link, and ties role storage to auth-provider metadata rather than the app's own source of truth.

## Consequences

- Pending invites (with their assigned role) are visible and listable immediately after sending, before the invitee acts.
- The claim flow's "already claimed, please sign in" vs. "invalid/expired" distinction (Standards §3) is derived from `organization_members.status`/`claimed_at`, not from interpreting Supabase's token-exchange error.
- The `(protected)` route guard must check membership `status = active`, not just session presence — a valid session with `status: pending` is hard-redirected to set-password.
