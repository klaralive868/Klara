# ADR-0007: Resource images are a public Storage bucket

- Status: Accepted
- Date: 2026-07-26

## Context

ADR-0005 made `catalog-images` private and explicitly deferred the "should product images be publicly readable" question to the storefront module's own future design work, since Catalog's build was admin-only at the time with no public consumer yet specified.

Bookings is different: the public booking flow (#42/#43) already exists and is live — an unauthenticated visitor browses a `published` resource's real detail page today. That page's photo gallery is the concrete, already-specified public consumer ADR-0005 was waiting on; there's no future design work left to defer to. Standards §1's bar for making a bucket public — "genuinely meant to be public," decided deliberately, not by default — is satisfied now, for this bucket specifically.

## Decision

The `resource-images` bucket is **public** (`public: true`). Once uploaded, an image's URL is a plain public Storage URL, not a signed one — no expiry, reachable by anyone with the URL, matching what "visible on the public site" actually requires.

Path convention (`{organization_id}/{resource_id}/{image_id}.{ext}`) is unchanged from Catalog's, but for this bucket the org-id path segment is **not** the protection mechanism for reads — it's public regardless of path. It still matters for **writes**: `storage.objects` RLS policies scope insert/delete to `authenticated` requests whose own `current_organization_id()` matches the path's first segment, same as Catalog.

## Consequences

- A resource's images become visible to anyone the moment they're uploaded, not just once the resource is `published`. This build doesn't gate visibility on the resource's own lifecycle status — flagged here as a known, accepted looseness (mirroring the same class of judgment call ADR-0005 made for Catalog, just landing on the opposite answer), not an oversight.
- `resource_images` itself (the DB table: which images exist, which is primary) is still `authenticated`-only via RLS — only the Storage *objects* are public. A visitor can view an image if they have its URL, but can't enumerate a resource's images or discover URLs except through whatever the app chooses to show them (currently: nothing yet — the public booking pages don't render real resource images as of this ticket; that's separate follow-up work, not blocked by this decision).
- No `anon`/`public` SELECT policy exists on `storage.objects` for this bucket — Supabase Storage serves `public: true` bucket downloads through its own public-object endpoint, which doesn't evaluate `storage.objects` RLS at all. The write policies (`insert`/`delete`, `authenticated`-only, org-path-scoped) are the only RLS this bucket needs.
