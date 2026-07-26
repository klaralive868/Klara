# ADR-0008: Every client-facing module gets a public API surface for external-site integration

- Status: Accepted
- Date: 2026-07-26

## Context

Simmo builds each client's actual website as a separate project — Klara doesn't host it. Bookings' public routes (`/book/[orgSlug]`, `/book/[orgSlug]/[id]`, `/book/[orgSlug]/inquiry`) work because Klara *is* the page the visitor lands on. That doesn't hold for a client whose real site lives elsewhere: WorldView's own booking form, hosted on WorldView's own domain, still needs to submit a request into Klara — a booking, an order, an inquiry — without becoming a Klara page itself. There's currently no way for an external site to write into Klara at all; the only public write path is a page action on a Klara-hosted route.

This is a recurring shape, not a one-off Bookings need: any future client-facing module (Catalog orders, provider-based Bookings, whatever comes next) will hit the same requirement the moment that module's client has their own site. Deciding the pattern once now, rather than re-deriving it per module, is the point of this ADR.

## Decision

Every module needing external-site integration exposes a versioned REST endpoint at `src/routes/api/v1/{module}/[orgSlug]/+server.ts` — GET for reads, POST for writes — **in addition to**, not instead of, any Klara-hosted public page-action route the module already has. The two are separate entry points into the same underlying operation.

Two non-negotiables, both extending principles already established for Bookings' public routes (Standards §12 has the full checklist):

1. **CORS is org-scoped via `organizations.allowed_origins`, never hardcoded per module or per client.** Hardcoding an allowed origin into a route handler doesn't scale past one client and re-introduces exactly the kind of per-client code branch Standards §4 already forbids for application logic — this is that same rule applied to CORS specifically. Every API endpoint checks the request's `Origin` header against the resolved org's `allowed_origins` and rejects anything not on that list.
2. **Shared logic between the page action and the API endpoint is never duplicated.** Org resolution from the URL slug, customer find-or-create, and rate-limiting are extracted into reusable server-side functions called from both entry points. A bug fixed in one and not the other is the direct, foreseeable cost of skipping this — the two entry points must share one implementation of "what this write actually does," differing only in how the request arrives (Svelte form data vs. JSON body) and how CORS is enforced (none needed for a same-origin page action; the allowlist check for the API).

Otherwise, the API endpoint follows the exact security shape already established for `/book/[orgSlug]`: resolve the organization from the URL slug (never a client-supplied org id), check origin, rate-limit, then write via the service-role client. The endpoint's own logic is the entire security boundary for that path — same principle, same reasoning, just a second door into it.

## Consequences

- `organizations.allowed_origins` (migration `20260730000000`) must be populated before a client's external site can call any module's API endpoint for their org — an unset/empty allowlist means every cross-origin request is rejected, fail-closed by default.
- A module built before this ADR (Bookings) gets its `api/v1/bookings/[orgSlug]/...` endpoints as a follow-up, not retroactively bundled into this decision — this ADR formalizes the pattern going forward; it doesn't itself implement Bookings' API surface.
- Versioning (`v1`) is committed to from the first endpoint, even though nothing has needed a `v2` yet — changing a public contract external sites depend on without a version bump would break integrations Klara doesn't control the deploy timing of, unlike Klara's own hosted pages.
- This does not change anything about Klara's own hosted public pages (`/book/[orgSlug]/...` and equivalents) — those keep using page actions as their primary entry point; the API surface is additive.
