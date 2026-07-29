# Klara — Architecture Brief (v2, post-restart)

> This is the current north-star document for Klara. It supersedes the original v1 brief. The core product vision is unchanged; the technical foundation, auth flow, and development workflow have been deliberately redesigned based on what was learned building v1. This document is the shared understanding a grilling session for any module should start from.

---

## 1. What Klara is

Klara is a multi-tenant SaaS platform — a "digital operating system" for small businesses, giving each business a portal to manage their website, content, customers, and operations through toggleable modules. The operator builds Klara once, then builds individual client websites that connect into it. Business model: recurring monthly subscription, with a 500+ prospect list of local businesses as the growth target.

Custom website-build work is billed separately from Klara subscriptions (see §8).

---

## 2. The three surfaces

1. **Client portal** — a business manages their content, customers, bookings, catalog, etc. What's visible is driven by which modules are enabled *and* featured for that client (see §6).
2. **Admin portal** — the operator manages all clients: provisioning, module assignment, featured-module curation, viewing a client's dashboard read-only for support.
3. **Public entry / landing** — marketing site plus the simplified sign-in/request flow (§3).

**The operator is a Client too.** The operator's own Client + Organization is created automatically at setup/seed time (a one-time bootstrap, not through the invite-link path), with every module enabled by default. The operator's dashboard has a dropdown to switch between "Dashboard" (their own client view — used for dogfooding) and "Admin" (the operator control panel). Same account, same session, just a view-switcher. Admin-portal access remains purely the operator-role check, never dependent on Organization membership in any client's org.

---

## 3. Auth & entry flow

**Deliberately minimal — no public landing page or lead-capture flow, for now.** Acquisition is operator-driven outreach, not inbound; the product has no need to sell itself to an anonymous visitor. This is a considered simplification, not an oversight — worth revisiting only if/when outreach volume makes inbound lead capture genuinely useful (deferred, not rejected outright).

**Just two screens exist:**

1. **Invite-link destination** (client provisioning): the operator provisions a client; the system generates a unique one-time invite link, emailed to the client. Clicking it lands on a **"Set your password"** screen — submitting sets the password and lands them directly in their dashboard. Single-use: revisiting after the account is claimed shows **"You've already created an account — please sign in."** Possessing the link is treated as equivalent proof of email control (a documented, narrow exception to requiring separate verification).

2. **Sign-in page** — email + password, for anyone who already has an account. This is the only public-facing entry point besides the invite-link destination itself.

**Session persistence is a first-class requirement, not an afterthought.** The v1 build shipped a bug where refreshing the page logged users out. The new auth foundation must get session restoration on page load correct from the start, verified by an explicit test: sign in, hard-refresh, confirm the session survives.

**Roles within a business** (owner / manager / staff, or similar — finalized during the auth module's grilling session) are managed via a hand-rolled `organization_members` table (a user's role lives on their membership row), NOT Better Auth's organization plugin — see §5 and ADR-0001 for why Better Auth was dropped entirely. A role determines both row-level visibility (via RLS, §5) and, where needed, column-level visibility (via views or application-layer filtering — RLS alone only controls which rows are returned, not which columns within them).

---

## 4. Core architectural principle: configuration over customization

Unchanged from v1, and still the single most important idea in Klara: every module is built once, plugged into many clients via **configuration stored as data**, never per-client code branches. The test at every module's grilling session: *"What varies per business, and can every variation be expressed as configuration?"* If not, it's a different module, not a fork.

This extends to vertical-specific depth where it earns its keep — e.g. Catalog is being built clothing-specific (curated Material Type registry, per-type size schemes) rather than generically abstract, because clothing businesses are a large, recurring segment worth a genuinely good, specific UX (see §7).

---

## 5. Data platform: Supabase (Postgres + RLS)

**Decision:** Supabase, replacing the original Convex-based foundation — and **Supabase's own Auth, dropping Better Auth entirely** (see ADR-0001). Reasoning: the v1 Convex + Better Auth integration relied on a community-maintained adapter that was the single largest source of friction. Moving to Supabase Auth removes the adapter problem at its root: RLS policies rely on `auth.uid()` reading Supabase's own JWT, and Better Auth issues a differently-shaped token — bridging the two would reintroduce exactly the adapter fragility that broke v1. Postgres (mature, portable, well-understood at scale), built-in realtime subscriptions, and built-in storage round it out. Roles/teams are handled by a hand-rolled `organization_members` table rather than any auth library's org plugin.

**This is a deliberate trade-off, held with eyes open:**
- Gained: auth integration stability, a standard relational database, a large ecosystem.
- Lost: Convex's automatic per-query reactivity (Supabase's realtime is subscription-based, not automatic on every query) and its colocated backend-functions model (Postgres needs an explicit backend/API layer — see §9).

**The critical security posture, given Supabase's architecture:** Supabase exposes database tables directly to the client via an auto-generated REST API (PostgREST). The `anon` key is public by design. **Security comes entirely from Row Level Security (RLS) policies** — a table without RLS enabled is fully exposed to anyone with the public key. Industry data shows the large majority of real-world Supabase security incidents trace back to exactly this: missing or misconfigured RLS, not platform-level vulnerabilities. This is Klara's single highest-priority technical risk given the platform holds many businesses' customer/financial data, and is addressed as a non-negotiable rule in the Standards doc, not a best-effort guideline.

---

## 6. The modules & the navigation growth pattern

**Module inventory** (unchanged from v1's intended set): Catalog, Bookings, Calendar, Customers/CRM, Invoicing, WhatsApp, Chatbot, Menus, Blogs, Analytics.

**Navigation as a growth surface — new in v2.** Rather than only showing enabled modules (v1's design), the navbar shows a **per-client curated set of "featured" modules** — some already enabled, some not. This is operator-set at provisioning time and editable anytime afterward via the admin portal (not client-configurable). A featured-but-not-enabled module renders as a **locked preview**: static, operator-authored educational content about the module (e.g. "why blogs help your conversion," "how to write blogs"), plus a **"Request this module"** action.

**Requesting a module is the same request-based flow as initial provisioning** — it notifies the operator, who assigns it manually, consistent with Klara's closed, operator-provisioned commercial model. This is deliberately *not* self-serve activation; a client cannot toggle a module on themselves.

**Non-featured modules** live behind a generic "Add module" browsing area, same locked-preview-and-request pattern.

**Data shape:** the existing `clientModules` table (client ↔ module, many-to-many, carrying `enabledAt`/`tier`) gains a `featured` field (boolean or ordinal) — same table, same pattern, one more configurable dimension.

**Educational content per module** is static, operator-authored, versioned with a deploy — same pattern as the Material Type registry (§7): a fixed list you write once, not user-generated.

---

## 7. Catalog module — vertical-specific by design

Catalog is being rebuilt deliberately **clothing-specific**, not generic, because the operator's actual pipeline is ~10-15 known verticals (not unlimited), and clothing is a large recurring segment where a genuinely tailored UX beats a generic one.

- **Material Type registry** — a curated, static, operator-defined list (Jersey, Shirt, Skirt, Dress, Shoes, Belt, Socks, etc.), not user-created. Same static-registry pattern as the module registry.
- **Each Material Type declares its own size scheme and relevant form fields.** Some need gendered sizing (Shoes: separate male/female size arrays via a `hasGenderVariant` flag), some need standard tops sizing (XS–2XL), some need none at all (sizing is optional per type).
- **One shared item add/edit form**, rendered differently depending on the selected Material Type — never a forked form per type.
- **Progressive disclosure:** a universal "common" set of Material Types shown by default in the picker; a "+ More materials" option reveals the rest in a modal.
- **Distinct from and complementary to categories/tags** (Male/Female/Kids/Jerseys-as-browse-filter): Material Type is structural (one per item, drives the form/sizing); categories are merchandising (many per item, drive storefront browsing).
- **A second vertical's Material Type list is a cheap addition later**, not a rebuild: the client-module `tier` field (e.g. `'clothing'`) selects which registry applies — the seam already exists from how `clientModules` is shaped, so adding e.g. a hardware-store registry later is a new registry entry, not new infrastructure.
- Standard elsewhere: multiple images with one primary/cover, draft/published/archived lifecycle with unhide, admin-side (owner/manager/staff) scope only in this build — public storefront browsing is a separate, later slice.

**Build order after the foundation:** Catalog (clothing) → CRM/Customers → Calendar, each connected to a real test project as it's built, per the tracer-bullet approach.

---

## 7b. Bookings module — two resource paradigms, one engine

Bookings must genuinely serve two different scheduling paradigms present in the real client pipeline — not a shallow label difference, two distinct availability models sharing one engine:

- **Provider-based** (vet, salon, consultant): a resource has *recurring weekly availability* (e.g. Mon–Fri 9–5); a booking occupies a slot within those hours. This is the paradigm Cal.com's model fits well — worth studying their conflict/slot-handling approach as a reference, though Klara's bookings stay native to Klara's own database (see §9's decision against Cal.com as system of record, to preserve cross-module automation).
- **Inventory-based** (car rental, equipment, event space): a resource is one of *N interchangeable units*; there's no recurring-hours concept — availability is purely the absence of an overlapping booking for that date range. Cal.com has no real analog for this paradigm.

**Shared data shape:**
- `resources` — `clientId`, `resourceType` (`'provider' | 'inventory-unit'`, extensible), name, quantity (meaningful for inventory, unused for provider).
- `availabilityRules` — shape branches by `resourceType`: recurring weekly windows for providers; not applicable / absent for inventory units.
- `bookings` — shared across both types: `resourceId`, `startAt`, `endAt`, `status`, `customerId`.
- **Conflict-check logic branches by `resourceType`**, but the booking lifecycle (request → confirm → cancel/reschedule → complete), the customer-facing request flow, and the operator's calendar view are shared, config-driven per client — same "one engine, config per vertical" principle as everything else in Klara.

**Build order:** provider-based (vet/salon-style) is the first tracer-bullet slice, built fully end-to-end before generalizing to inventory-based — both are confirmed real, near-term verticals, not speculative scope.

---

## 8. Commercial model

- **Polar.sh as Merchant of Record** for Klara subscriptions specifically. Custom website-build work is billed separately (bank transfer/local rails) — never through Polar, which excludes human services.
- **Domains** — purchased by the operator at cost, billed to the client as a marked-up line item on their first/onboarding invoice, with a yearly renewal rate on that cadence. Presented transparently, folded into the package total rather than sold as a standalone product — sidesteps any MoR-eligibility question for domain resale. Still real technical work when built (provider API, DNS config, renewal automation) — phase-later.
- **Team-seat billing:** $10/mo for up to 10 members, $25/mo beyond 10, counted from the `organization_members` table.
- **Closed, operator-provisioned model throughout** — clients never self-serve-purchase or self-serve-activate modules; every commercial action routes through the operator.

---

## 9. Infrastructure posture

**Framing unchanged: 500 local-SMB sites is not hyperscale.** Measure before optimizing.

- **Supabase** — Postgres, RLS, built-in storage, built-in realtime subscriptions.
- **A backend/API layer is now a real, explicit decision** (unlike Convex, where functions were colocated with the database) — this needs to be settled early in the fresh build: a lightweight server layer (SvelteKit's own server routes/`+server.ts` endpoints calling Supabase, or a dedicated API framework) sitting between the frontend and Postgres.
- **Sentry and Vercel are set up immediately, before feature work** — not bolted on later. A first deploy of the empty scaffold should prove the full pipeline (build, deploy, env vars) works before anything real depends on it.
- **Error tracking (Sentry) verified live across every real surface** (client, server, and now Postgres/backend-layer errors) before building further, each time a new surface is added.
- **One transactional email provider** — Resend, verified domain `klara.live`, sender `business@klara.live`. Sender address always read from an env var, never hardcoded; fails loudly if misconfigured.
- **Image handling** — Supabase Storage (built in) is the default; revisit Cloudflare R2 only if a real cost/scale reason emerges.
- **Deploy credentials are always scoped to least privilege** — a CI/build key gets only what a build needs (deploy + read env), never data or admin permissions — this is a general rule, not specific to any one platform.

---

## 10. Development workflow — visual-first

A deliberate change from v1's approach. Screens are built in two distinct phases:

1. **Design the flow in Figma.**
2. **Build static UI in shadcn-svelte** — components installed as raw, unwired pieces via the shadcn CLI, screens assembled with placeholder content, purely visual and clickable. No backend, no tests yet.
3. **Wire logic afterward** — connect the static screen to real Supabase queries/mutations, one screen at a time.

This means the pipeline's ticket shape splits accordingly:
- **Static UI ticket** — visual/flow assembly only, reviewed on design/flow grounds, no automated tests (there's nothing to test yet).
- **Wire-logic ticket** — connects an existing static screen to real backend behavior, tested per the standard protocol (Standards §8).

Component styling uses a **custom shadcn-svelte theme preset** (colors, fonts, radius) established before any real screens are built, rather than shadcn's defaults.

---

## 11. What's carried forward from v1, unchanged

- Config-over-customization as the central principle (§4).
- The tracer-bullet / vertical-slice build discipline.
- The `grill → spec → tickets → implement → review (in-session + Greptile)` pipeline itself — Matt Pocock's skill set, Greptile pointed at the Standards doc.
- The general shape of hard-won operational lessons that aren't Convex-specific: deferring post-signup side-effects until auth state is genuinely confirmed ready; verifying "success" states actually persisted the claimed change rather than trusting a UI signal; scoping credentials to least privilege; diagnosing before theorizing on bugs.
- Automation engine as an explicit phase-two capability, once enough modules exist to connect.
