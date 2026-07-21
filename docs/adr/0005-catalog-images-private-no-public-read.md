# ADR-0005: Catalog images are private, with no public read access in this build

- Status: Accepted
- Date: 2026-07-21

## Context

Standards §1 requires storage buckets to be private by default, made public only after a deliberate decision that the contents are genuinely meant to be public — never as a default or for convenience, and never relying on a tenant-id-encoded path alone as protection. This build (per Architecture Brief §7) is scoped to admin-side Catalog item management only; public storefront browsing is an explicitly separate, later slice.

A future reader adding storefront browsing might reasonably assume Catalog images should already be public, since "customers need to see product photos" seems obvious. Making that call here, before the storefront module's own design work, would be deciding a security posture (bucket visibility) based on a feature that doesn't exist yet.

## Decision

The `catalog-images` bucket is **private**, full stop, for this build. Images are only reachable via signed URLs or authenticated requests from the admin UI. No public read access is granted now.

Whether and how images become publicly readable is deferred to the storefront module's own grilling session — that's where the real requirements (which images, at what point in the draft/published/archived lifecycle, whether signed URLs with expiry are sufficient vs. genuine public access) actually get decided, with the storefront's real shape in view.

## Consequences

- Storefront work, whenever it starts, has an explicit open question to resolve: how do published items' images become visible to anonymous visitors. This ADR intentionally doesn't answer that — flag it as a dependency when that module is grilled, don't assume an answer from here.
- Nothing in this build (admin CRUD, RLS policies) needs to account for anonymous/public read paths — simplifies the RLS policy set to the same `current_organization_id()`-scoped pattern used everywhere else, no public-vs-private branching logic.
