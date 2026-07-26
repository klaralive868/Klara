# Bookings module — travel package requests (WorldView Travel Service)

**Status:** spec, not yet built. First real slice of the Bookings module, for real client WorldView Travel Service.

**Build-order note:** Brief §7b lists provider-based (vet/salon-style) as the first Bookings tracer-bullet slice. This spec deliberately builds a different shape first, against WorldView's real, immediate need — a documented deviation, not silent drift. See [ADR-0006](./adr/0006-travel-package-bookings-before-provider-slice.md).

Domain terms used throughout (Resource, Uncapped resource, Travel Inquiry) are defined in [`CONTEXT.md`](../CONTEXT.md)'s Bookings section.

## Problem Statement

WorldView Travel Service sells travel packages (flights + hotels + itineraries) to customers. Today they have no way to list their packages online or take structured booking requests — everything happens by phone/email with no shared record. They need: a public page per package their customers can browse and request to book, a way for their agent to review and confirm requests (against real-world constraints like actual airline/hotel seat availability that no software can see), and a way for a customer to ask for a custom trip that doesn't match any existing package.

## Solution

A two-sided module:
- **Agent-facing** (existing `(protected)` client portal, authenticated): WorldView's agent creates and manages "resources" (specific package departures — e.g. "Bali 7-Day Tour, Aug 12 departure"), publishes them when ready, and reviews/confirms incoming booking requests and custom trip inquiries.
- **Public-facing** (new, unauthenticated): each published resource gets its own page on WorldView's live site where a visitor can view details and submit a booking request. A separate "request a custom trip" form captures inquiries that don't match any existing resource.

Both request types are always created in a pending/request state — never auto-confirmed — because the agent must reconcile against real-world availability the system has no visibility into.

## User Stories

1. As WorldView's agent, I want to create a new package departure with a name, description, dates, and optional seat cap, so that I can start assembling a trip before it's ready for customers to see.
2. As WorldView's agent, I want a package to stay in draft until I publish it, so that an incomplete or unpriced package is never visible to the public.
3. As WorldView's agent, I want to publish a draft package, so that it appears on WorldView's public site.
4. As WorldView's agent, I want to archive a published package (and unarchive it back to draft), so that a sold-out or discontinued departure stops taking new requests without losing its data.
5. As WorldView's agent, I want to leave a package's seat capacity unset, so that packages with no hard limit never auto-reject a request for being "full."
6. As WorldView's agent, I want to set a hard seat cap on a package when one genuinely exists, so that I have a reference number when deciding whether to confirm more requests.
7. As WorldView's agent, I want to see how many seats are consumed by confirmed bookings and how many more are pending, even when a cap is set, so that I can make an informed call — without the system ever blocking a new request on my behalf.
8. As a site visitor, I want to view a published package's page (description, dates, price, images), so that I can decide whether to request it.
9. As a site visitor, I want to submit a booking request for a package with my name, email, phone, and traveler count, so that WorldView's agent can follow up and confirm.
10. As a site visitor, I want to add notes to my booking request (e.g. names of other travelers, special requests), so that the agent has the context they need without a rigid form.
11. As a returning site visitor (same email as a past request), I want my new request linked to my existing customer record rather than creating a duplicate, so that WorldView's agent sees my history in one place.
12. As a site visitor, I want to submit a "design a custom trip for me" request describing what I'm looking for, when no existing package fits, so that WorldView's agent can put together something tailored.
13. As WorldView's agent, I want to see all booking requests and travel inquiries for my organization, and nobody else's, so that another business's data is never mixed with mine.
14. As WorldView's agent, I want to confirm, cancel, or mark a booking request complete, so that its status reflects what actually happened after I reconcile with real-world availability.
15. As WorldView's agent, I want a booking's departure/return dates to come from the package I'm confirming against, not be freely editable by the requester, so that a customer can't accidentally request different dates than the package actually runs.
16. As the operator, I want to set WorldView's public URL slug when I provision their organization, so that their public booking pages have a stable, readable URL instead of a raw database id.
17. As anyone on the internet, I want the public booking/inquiry forms to be rate-limited, so that the endpoints can't be trivially spammed.
18. As a customer of any *other* organization on Klara, I want it to be structurally impossible for my data to appear when someone else's public page is viewed or their agent reviews their requests, so that tenant isolation holds even on the new unauthenticated surface.

## Implementation Decisions

### Domain model

- `resourceType` stays exactly two values per Brief §7b: `provider`, `inventory-unit`. **No third type is added.** WorldView's packages are `inventory-unit` resources with two new, decoupled properties (below) — not a new paradigm.
- `requiresManualConfirmation` (boolean) is a property of a resource, independent of `resourceType` — not inherent to any particular type. Defaults `true` for WorldView's resources. This keeps the door open for, e.g., a future inventory-unit client (car rental) to also opt into manual confirmation without inventing another `resourceType`.
- **One `resources` row = one specific departure** (e.g. "Bali 7-Day Tour — Aug 12"), not an abstract package with many dates. No package-grouping entity exists in this slice — two departures of "the same" underlying trip are two independent resource rows, related only by naming convention the agent chooses. Follows that the departure/return date range is a property of the **resource**, not freely chosen per booking (User Story 15) — a booking's `startAt`/`endAt` are populated from the resource's own dates at creation time, not independently supplied by the requester. This is slightly redundant with the shared `bookings.startAt/endAt` shape (which exists for paradigms — like a generic rental unit — where the same resource legitimately serves different date ranges per booking), but keeping the shared columns rather than special-casing them preserves one shared `bookings` table across all resource types.
- **Capacity is optional and never blocks request creation.** `resources.quantity` is nullable; `null` means uncapped (pure request log, no capacity comparison ever runs). Even when a cap *is* set, a new booking request is always allowed to be created — the same reasoning that makes auto-*confirm* unsafe (the system can't see real airline/hotel seats) makes auto-*reject* equally unsafe. Conflict-check instead computes two informational counts for the agent's UI: seats consumed by `confirmed` bookings, and seats consumed by `pending` bookings — never used to block anything.
- **Travel Inquiry is a separate table, upstream of Resources.** A customer describing a trip they want with no existing resource to book against isn't a booking (a booking always has a `resourceId`) — it's a lead the agent may later turn into a real resource + booking, but isn't one itself.
- **No payment/deposit collection in this slice.** Purely request-capture; WorldView reconciles payment through its own existing offline process once it confirms a booking.

### Schema

New tables (all RLS-enabled, `snake_case`, following Catalog's established conventions):

**`resources`** — one row per bookable package departure.
- `organization_id` (default `current_organization_id()`, FK to `organizations`, cascade delete) — the root table here, denormalized column is correct (nothing more fundamental to check against).
- `resource_type` (`'provider' | 'inventory-unit'`; only `'inventory-unit'` populated by this slice)
- `name`, `description` (public-facing copy)
- `departure_date`, `return_date`
- `quantity` (nullable integer — capacity; `null` = uncapped)
- `requires_manual_confirmation` (boolean, not null, default `true`)
- `status` (`draft | published | archived`, mirroring Catalog Item's lifecycle exactly — `archived` always reversible to `draft`). Only `published` resources are visible through the public route/server action.
- Price: **assumption, not explicitly grilled** — recommend `price_cents` (matching Catalog's `catalog_items.price_cents` convention) since a real public package page needs a price shown. Flag for confirmation before implementation.
- Images: **assumption, not explicitly grilled** — recommend reusing Catalog's multiple-images-with-one-primary pattern, but note this can **not** reuse ADR-0005's private-bucket-with-signed-URLs decision as-is: ADR-0005 scoped Catalog images to private/no-public-read specifically because Catalog had no public storefront yet. WorldView's resource images *do* need public visibility once a resource is published. Recommend a separate, genuinely-public Storage bucket (`resource-images`, `public: true`) rather than extending ADR-0005's private-bucket policy to also serve public reads. Flag for confirmation before implementation.

**`bookings`** — shared shape per Brief §7b, no `organization_id` column (derived via `EXISTS` against `resources.organization_id` — see RLS note below).
- `resource_id` (FK to `resources`)
- `customer_id` (FK to `customers`)
- `traveler_count` (integer, not null) — consumes capacity per-traveler, not per-booking, when the resource's `quantity` is set
- `notes` (text, nullable) — freeform; covers additional traveler names/special requests without a structured sub-entity
- `start_at`, `end_at` — populated from the resource's `departure_date`/`return_date` at creation time (see Domain model note above)
- `status` (`pending | confirmed | cancelled | completed`) — always created `pending`; no fast-path to `confirmed`

**`travel_inquiries`** — upstream of `resources`/`bookings`, no `organization_id` column (derived via `EXISTS` against `customers.organization_id`).
- `customer_id` (FK to `customers`)
- Freeform trip description fields: destination/description, preferred dates (text, not a strict range — nothing confirmed yet), party size (nullable integer), budget (text), notes
- `status` (`new | in-progress | converted | closed`)

**`organizations`** — add `slug` (`text not null unique`), operator-set at provisioning (defaults to a slugified business name, editable). Needed for public URLs (`/book/<org-slug>/<resource-id>`); the existing `/admin/clients/new` flow (from PR #34) needs updating to collect it.

### RLS & the public-write path

- **Every table above keeps RLS as an `authenticated`-only tenant boundary**, following the exact pattern already established for `customers`/`catalog_items`: `select`/`insert`/`update`/`delete` policies scoped to `organization_id = current_organization_id()`. No `anon` grants are added anywhere.
- **`bookings` and `travel_inquiries` deliberately have no denormalized `organization_id` column** — this directly applies the lesson already learned and documented in `docs/catalog-module.md` ("RLS design: EXISTS, not denormalized"): a denormalized `organization_id` column checked only via `with check` is spoofable, because FK existence checks bypass RLS — a caller could set `organization_id` to their own org while `resource_id`/`customer_id` pointed at another organization's row. Policies instead use `EXISTS (select 1 from resources/customers where ... .id = bookings.resource_id and ....organization_id = current_organization_id())`, tying every write to a column that's independently trustworthy. Applied proactively here, not found-and-fixed after the fact this time.
- **The public booking/inquiry forms never touch RLS at all.** A SvelteKit server action resolves the target organization *server-side* from the URL's slug (never client-supplied), validates input, applies rate-limiting (reusing the existing `rate-limit.ts` pattern already used for sign-in), and writes via the service-role client — the same pattern already used for admin client-provisioning (PR #34). The server action's own logic is the entire security boundary for this path, by design — RLS stays exclusively the authenticated-tenant boundary it already is everywhere else in the app.
- Public reads (resolving a resource for its public page) go through the same server-side, slug-resolved, service-role path — never exposed as a client-side RLS-scoped query, so there's no `anon` SELECT grant to reason about either.

### Customer linkage

- A public booking or inquiry submission's server action looks up an existing customer by `(organization_id, email)` case-insensitive, within the slug-resolved organization, before creating anything.
  - **Match found:** reuse that customer's id. Existing name/phone are **not** overwritten — a returning customer's details might legitimately differ request-to-request, and staff may have already edited the record directly.
  - **No match:** create a new customer with `source: 'booking'` (the `customers.source` check constraint already includes this value — the Customers migration anticipated this exact use case).

### Sequencing

Build and test against a local seeded organization first, using the same e2e conventions already established (dedicated test org, dedicated test user per spec file). WorldView is provisioned for real through the (now slug-aware) `/admin/clients/new` flow only as the final live-verification step, mirroring exactly how Netbreakerz was provisioned in this session — not a precondition to starting the build.

### Standards §10 correction

This spec's public-facing scope (public browse + package pages) directly surfaced a contradiction in the previous wording of Standards §10, which has been corrected as part of this work: "public storefront browsing" is no longer categorically deferred. A module connecting fully to a business's live website is now understood to be part of what "done" means for a module, governed by the existing "build against a real client's need" principle rather than treated as an automatically later phase. See the current `docs/klara-standards-v2.md` §10 for the corrected text. This does **not** retroactively obligate Catalog (or any other shipped module) to grow a public storefront — that remains Netbreakerz's call, separately, if/when they need it.

## Testing Decisions

Following the exact layered pattern established in `docs/catalog-module.md`:

- **Vitest (unit):** pure validation functions for both the agent-facing resource form and the public booking/inquiry forms (mirroring `parseCreateClientForm`/`parseCatalogItemForm` conventions) — malformed email, missing required fields, invalid traveler count, etc.
- **pgTAP (RLS):** new test files for `resources`, `bookings`, `travel_inquiries` following `supabase/tests/0005`–`0009`'s pattern — own-org read/write allowed, cross-org denied, and an explicit regression test proving the `EXISTS`-based `bookings`/`travel_inquiries` policies can't be spoofed via a mismatched `resource_id`/`customer_id` (the exact class of bug documented as found-and-fixed in Catalog, verified here proactively).
- **Playwright (e2e):**
  - Authenticated agent flows: create/edit/publish/archive a resource, confirm/cancel/complete a booking, review a travel inquiry — mirroring `catalog-item-crud.spec.ts`'s create→edit→persist pattern, with its own dedicated test user per the established rate-limit-bucket-isolation convention.
  - **New pattern needed:** unauthenticated public-flow tests — hit the public route with no session, submit a booking/inquiry, verify it lands correctly scoped to the right organization via the DB (using the same `admin-client.ts` service-role helper pattern already used elsewhere in `e2e/`), verify a draft/archived resource's public page 404s or is otherwise inaccessible, verify customer-dedup behavior (same email twice → one customer, two bookings), and a cross-organization isolation check confirming one org's public page/data is never reachable through another org's slug.
  - Rate-limiting on the public endpoints, following the same test pattern already used for sign-in's rate limit.

## Out of Scope

- A "package" grouping entity above individual resource/departure rows (e.g. "show all 3 upcoming Bali Tour departures together") — each departure is an independent resource; revisit only if a real client need for grouping emerges.
- Structured per-traveler records (names, passport numbers, etc.) — covered by freeform `notes` for now.
- Payment or deposit collection at request time.
- A dynamic, client-authored field registry for Bookings (mirroring `customer_field_definitions`) — a single fixed `notes` column covers the stated need; revisit if a second Bookings-consuming vertical needs configurable structured fields.
- Automation engine and self-serve module activation (still deferred per Standards §10, unaffected by this spec's §10 correction).
- Provider-based (vet/salon-style) Bookings slice — still the next paradigm to build when a real client needs it (per ADR-0006, this spec doesn't change that ordering going forward, only for this one slice).

## Further Notes

- Two flagged assumptions (`price_cents` on resources, and a public image-storage bucket) were not explicitly grilled and should be confirmed before implementation starts — see the Schema section above.
- The admin client-provisioning flow (PR #34, `/admin/clients/new`) needs a small follow-up change to collect `organizations.slug` at creation time — not part of this spec's build, but a direct dependency of it.
