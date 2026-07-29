# Bookings module

Travel-package booking requests for WorldView Travel Service — the Bookings module's first real slice, built against a real client's immediate need rather than the Brief's originally-planned provider-based (vet/salon) tracer bullet ([ADR-0006](./adr/0006-travel-package-bookings-before-provider-slice.md)). Two-sided: an authenticated agent portal to manage package departures and review requests, and a new unauthenticated public surface for a business's own customers to browse and submit requests.

Built across 14 tickets tracked under parent issue [#35](https://github.com/klaralive868/Klara/issues/35). Full spec: [`docs/bookings-travel-packages-spec.md`](./bookings-travel-packages-spec.md). Backed by three ADRs: [0006](./adr/0006-travel-package-bookings-before-provider-slice.md) (why this slice, not the Brief's planned one), [0007](./adr/0007-resource-images-public-bucket.md) (resource images are public, unlike Catalog's private bucket), and [0008](./adr/0008-public-api-surface-per-module.md) (the `api/v1` public API surface, below — a standing pattern first implemented here).

## Domain model

| Term | Meaning |
|---|---|
| **Resource** | One specific package departure (e.g. "Bali 7-Day Tour — Aug 12"), not an abstract package spanning many dates. `resourceType` is exactly `provider` or `inventory-unit` (Brief §7b) — WorldView's packages are `inventory-unit`. Has its own lifecycle (`draft` → `published` → `archived`, reversible), dates, optional price, optional seat capacity, and images. |
| **Uncapped resource** | A resource with `quantity = null` — no hard seat limit, so a new request is never auto-rejected for being "full." When a cap *is* set, it's informational only: the agent sees confirmed-vs-pending counts, but capacity never blocks a new booking request — only real-world availability (which the system can't see) does. |
| **Booking** | A request to travel on a specific resource: traveler count, freeform notes, and a status (`pending` → `confirmed`/`cancelled`/`completed`). Always created `pending` — never auto-confirmed. `start_at`/`end_at` are copied from the resource's own dates at creation, not freely chosen by the requester. |
| **Travel Inquiry** | Upstream of Resources — a "nothing existing fits, design me a trip" lead, not a booking (no `resource_id`). Freeform trip description, preferred dates, party size, budget, notes, and its own status (`new` → `in-progress`/`converted`/`closed`). |

Full glossary entries live in [`CONTEXT.md`](../CONTEXT.md).

## Data model

Four new tables plus a new column on `organizations`, all `snake_case`, RLS-scoped, deny-by-default beyond what's explicitly granted.

```
organizations (+ slug)
resources
├── resource_images (Storage-backed, public bucket)
└── bookings ──── customers
travel_inquiries ──── customers
```

| Table / column | Migration | Key columns | Notes |
|---|---|---|---|
| `organizations.slug` | `20260725055912` | `slug text not null unique` | Stable public URL segment (`/book/<slug>/...`), operator-set at provisioning. Backfilled for pre-existing orgs via a slugify-with-collision-suffix loop. |
| `resources` | `20260725120000` | `organization_id` (denormalized, root table), `resource_type`, `name`, `description`, `departure_date`, `return_date`, `quantity` (nullable), `requires_manual_confirmation`, `price_cents`, `status` | `status` ∈ `draft`/`published`/`archived`, mirroring Catalog Item exactly. `return_date >= departure_date` enforced by check constraint. |
| `bookings` | `20260725140000`, RLS added `20260726120000` | `resource_id`, `customer_id`, `traveler_count`, `notes`, `start_at`, `end_at`, `status` | **No `organization_id` column** — derived via `EXISTS` against `resources.organization_id` (see below). `authenticated` insert/update additionally require `customer_id` to resolve to the caller's own org via a *separate* `EXISTS` against `customers` — otherwise an agent could attach their own org's resource to a customer belonging to a different org. |
| `travel_inquiries` | `20260727000000`, service-role grant `20260728000000` | `customer_id`, `trip_description`, `preferred_dates`, `party_size` (nullable), `budget`, `notes`, `status` | Also no `organization_id` — `EXISTS` against `customers.organization_id`, applied from the start (unlike `bookings`, which staged this as a follow-up ticket). |
| `resource_images` | `20260729000000`, promote-next-primary `20260729010000` | `resource_id`, `storage_path`, `is_primary` | Same shape as Catalog's `catalog_item_images`, but backed by a **public** Storage bucket ([ADR-0007](./adr/0007-resource-images-public-bucket.md)) instead of private+signed-URL. |
| `customers.source` | `20260728010000` | check constraint | Expanded from `('booking','manual','import')` to add `'inquiry'` — a code-review fix once `findOrCreateCustomer` (built for bookings) got reused for inquiry submissions and was mislabeling the customers it created. |

### Storage

Public bucket `resource-images` (`public: true`) — the one deliberate divergence from Catalog's `catalog-images` (private, signed URLs). Path convention `{organization_id}/{resource_id}/{image_id}.{ext}`, same as Catalog. Writes stay `authenticated` + own-org-path-scoped RLS; reads need no policy at all, since Supabase serves a public bucket's objects through its public-object endpoint without evaluating `storage.objects` RLS.

### RLS design: EXISTS, not denormalized

`bookings`, `travel_inquiries`, and `resource_images` all scope RLS via `EXISTS` against their parent's `organization_id`, applying the lesson already documented in [`docs/catalog-module.md`](./catalog-module.md#rls-design-exists-not-denormalized) proactively rather than rediscovering it — a denormalized `organization_id` column is spoofable via FK-existence-check bypass of RLS.

### Structural invariants enforced by triggers

- **First-upload auto-primary + concurrency lock** (`set_first_resource_image_primary`, `BEFORE INSERT` on `resource_images`): same auto-primary behavior as Catalog's equivalent trigger, plus `pg_advisory_xact_lock(hashtext(resource_id))` to serialize concurrent first-uploads for the *same* resource — added as a Round-1 security-review fix after concurrent uploads could both observe "no primary yet" and collide on the partial unique index. Uploads for different resources hash to different lock keys and never block each other.
- **Promote-next-primary** (`AFTER DELETE` on `resource_images`): mirrors Catalog's — removing the primary image promotes the oldest remaining one for that resource.

### Atomic RPC

`mark_resource_image_primary(image_id)` — `SECURITY INVOKER`, unmarks the current primary (if any) and marks the given one in one transaction, avoiding a window with zero or two primaries.

## Business rules

- **Capacity never blocks a request** — even a hard-capped resource always accepts a new booking; the cap only feeds the agent's confirmed/pending counts.
- **Booking dates come from the resource, not the requester** — `start_at`/`end_at` are populated from `resources.departure_date`/`return_date` at creation time.
- **Everything starts pending** — bookings and inquiries are never auto-confirmed; the agent always reconciles against real-world availability.
- **Archive is always reversible** — `archived → draft`, same as Catalog, never a dead end.
- **Customer dedup on public submission** — matched by `(organization_id, email)` case-insensitive; a match reuses the id without overwriting existing name/phone, a miss creates one with the correct `source`.
- **Image sanitization, not just sniffing** — `uploadImages` decodes every file server-side with `sharp` and stores sharp's own re-encoded output, never the client's original bytes (a Round-2 security-review fix; a prefix-only magic-byte check couldn't catch a polyglot — valid image header, arbitrary content appended after). See [`src/lib/server/image-sanitize.ts`](../src/lib/server/image-sanitize.ts).
- **Storage-before-DB-row on delete** — `removeImage` deletes the Storage object *before* the DB row (the reverse of Catalog's order, deliberately): in a public bucket, an object that outlives its DB row is reachable forever with no record it should be gone, whereas a DB row that outlives its object just 404s and can be retried.

## Routes and actions

**Agent-facing** (`(protected)/dashboard/...`):

| Route | Purpose |
|---|---|
| `GET /dashboard/resources` | Resource list, scoped to caller's org via RLS. |
| `GET/POST /dashboard/resources/new` | Create form. Action `default`: creates a draft resource. |
| `GET/POST /dashboard/resources/[id]/edit` | Edit form. Actions: `update`, `publish`, `archive`, `unarchive`, `uploadImages`, `setPrimaryImage`, `removeImage`. |
| `GET /dashboard/bookings` | Booking list, newest first. |
| `GET/POST /dashboard/bookings/new` | Agent-logged manual booking (e.g. a phone call). |
| `GET/POST /dashboard/bookings/[id]` | Detail + actions: `confirm`, `cancel`, `complete`. |
| `GET /dashboard/inquiries` | Travel inquiry list. |
| `GET/POST /dashboard/inquiries/new` | Agent-logged manual inquiry. |
| `GET/POST /dashboard/inquiries/[id]` | Detail + actions: `startProgress`, `convert`, `close`. |

**Public-facing** (unauthenticated, `src/routes/book/[orgSlug]/...`):

| Route | Purpose |
|---|---|
| `GET /book/[orgSlug]` | Published-resource list for the org the slug resolves to (server-side, service-role — never client-supplied org id); 404s on an unknown slug. |
| `GET/POST /book/[orgSlug]/[id]` | Resource detail + booking form. Action `default`: rate-limits, finds-or-creates the customer, creates a `pending` booking. |
| `GET/POST /book/[orgSlug]/inquiry` | "Design a custom trip" form. Action `default`: layered rate-limit (IP-only, then IP+email), finds-or-creates the customer (`source: 'inquiry'`), creates a `new` inquiry. |

Public writes never touch RLS by design — the server action resolves the org from the URL slug, rate-limits, and writes via the service-role client. The action's own logic is the entire security boundary for that path.

**Public API** (unauthenticated, CORS-gated, `src/routes/api/v1/bookings/[orgSlug]/...`) — ticket [#62](https://github.com/klaralive868/Klara/issues/62), the first implementation of the standing pattern formalized in [ADR-0008](./adr/0008-public-api-surface-per-module.md) / Standards §12. Lets a client's own separately-hosted website submit into Klara without becoming a Klara page:

| Route | Purpose |
|---|---|
| `GET /api/v1/bookings/[orgSlug]/resources` | List published resources — JSON equivalent of `GET /book/[orgSlug]`. |
| `GET /api/v1/bookings/[orgSlug]/resources/[id]` | One published resource — JSON equivalent of the detail half of `GET /book/[orgSlug]/[id]`. |
| `POST /api/v1/bookings/[orgSlug]/resources/[id]/book` | Submit a booking — JSON equivalent of `POST /book/[orgSlug]/[id]`'s `default` action. |
| `POST /api/v1/bookings/[orgSlug]/inquiries` | Submit an inquiry — JSON equivalent of `POST /book/[orgSlug]/inquiry`'s `default` action. |

Every route also exports `OPTIONS` for CORS preflight. All four share [`src/lib/server/public-api.ts`](../src/lib/server/public-api.ts)'s `resolvePublicApiRequest` — module-agnostic, reusable by any future module's API surface — which resolves the org from the slug and checks the request's `Origin` header against `organizations.allowed_origins` (fail-closed: an unset/empty allowlist, or a request with no `Origin` header at all, is rejected the same as an origin not on the list). Body-parsing and rate-limiting stay in each endpoint, same as the page actions, since rate-limit bucket keys depend on the parsed body.

`parseBookingForm`/`parseInquiryForm` (`src/lib/server/public-booking.ts`, `public-inquiry.ts`) take a plain record rather than `FormData` specifically so both the page action (`Object.fromEntries(formData)`) and this JSON API share one validation implementation — no duplicated business logic between the two entry points (ADR-0008's non-negotiable).

### Rate limiting

Reuses the existing in-memory `src/lib/server/rate-limit.ts` (same module sign-in uses):

- Booking submission: 5 attempts / 15 min, keyed by IP + email.
- Inquiry submission: two layers — 20 / 15 min keyed by IP alone (checked first), then 5 / 15 min keyed by IP + email.

## Testing

| Layer | Coverage |
|---|---|
| Vitest (unit) | Public + agent form validation; `image-sanitize.ts`'s decode/re-encode logic, including a dedicated polyglot-attack test (valid image header + malicious appended payload → stripped); `isOriginAllowed` (`public-api.test.ts`) — allowed/unlisted/empty-allowlist/missing-`Origin`-header cases. |
| pgTAP (RLS) | `supabase/tests/0011`–`0014` — own-org allowed / cross-org denied for `resources`, `bookings`, `travel_inquiries`, `resource_images`. |
| Playwright (e2e) | `resource-crud`, `booking-crud`, `inquiry-crud`, `resource-images`, `public-booking`, `public-inquiry`, `public-api-bookings` — agent CRUD/lifecycle flows, unauthenticated public-page-action-flow tests, and (new) the `api/v1/bookings` surface: preflight headers, allowed/rejected/missing origin, successful book/inquiry, unknown-org 404, cross-org isolation, rate-limiting, and a regression check that the page-action flows still work post-refactor. |

Each spec uses its own dedicated e2e test user (`RESOURCES_OWNER_EMAIL`, `BOOKINGS_OWNER_EMAIL`, `INQUIRIES_OWNER_EMAIL`, `RESOURCE_IMAGES_OWNER_EMAIL`) so parallel sign-ins don't share a rate-limit bucket across files; cross-org checks reuse the existing generic `SECOND_ORG_EMAIL`.

## Security review rounds (resource images)

Ticket #40 (wire resource images) went through two rounds of security-focused code review before merge:

1. **Round 1** — `removeImage` deleted the DB row before the Storage object (reversed, see Business rules above); `uploadImages` trusted the client's filename/Content-Type (replaced with magic-byte sniffing, later superseded); the first-upload-auto-primary trigger had a concurrency race (fixed with an advisory lock).
2. **Round 2** — magic-byte sniffing alone was insufficient against a polyglot payload; replaced with full server-side decode + re-encode via `sharp`, storing only the decoder's own output.

## Live verification status

Production (`www.klara.live`) was found stale — several tickets behind `main`, including the `organizations.slug` field — and has since been redeployed via `vercel --prod` to match `main`. The client-provisioning flow (business name, slug, org-row-rollback-on-invite-failure) was confirmed working end-to-end against production. Provisioning World View Travel's real organization is currently blocked on Supabase's transactional email delivery (Resend account needs a paid plan) — an external/billing dependency, not a code issue. `business@klara.live`'s operator password was reset to a known value at the user's request to restore direct access in the meantime.

## Out of scope (this build)

- A "package" grouping entity above individual resource/departure rows.
- Structured per-traveler records (names, passport numbers) — freeform `notes` covers this.
- Payment or deposit collection at request time.
- A dynamic, client-authored field registry for Bookings (mirroring `customer_field_definitions`).
- Automation engine and self-serve module activation.
- Provider-based (vet/salon-style) Bookings slice — deferred per [ADR-0006](./adr/0006-travel-package-bookings-before-provider-slice.md), next when a real client needs it.
