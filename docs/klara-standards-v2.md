# Klara — Engineering Standards (v2, post-restart)

> This supersedes the v1 Standards doc. It's the ruleset every change is measured against — checked by the pipeline's Dissect/spec stage and by review (in-session `code-review` + Greptile, pointed at this file). Rules are imperative, each with a one-line _why_, so conformance can be judged without re-deriving the reasoning.

---

## 1. Row Level Security (RLS) — the highest-priority rule in this document

Given Supabase's architecture (tables are exposed directly to the client via PostgREST; the `anon` key is public by design), **RLS is the primary security boundary, and getting it wrong is the single most common cause of real-world Supabase data breaches.** This section is not a guideline — every rule here is a hard requirement.

- **Every table MUST have RLS enabled, without exception, from the moment it's created.** A table created without RLS is fully readable/writable by anyone holding the public `anon` key the instant it exists — treat "create table" and "enable RLS" as one atomic action, never two separate steps.
- **Never use `USING (true)` or any permissive policy that doesn't actually check identity/ownership.** A policy that returns true for everyone is functionally identical to no RLS at all — this exact pattern is the single most common real-world Supabase vulnerability.
- **Every policy must be tested against denied-access scenarios, not just the happy path.** A test suite that only checks "the right user can see their own data" is incomplete — it must also assert "a different, real, authenticated user CANNOT see this data," using genuinely different test identities. This is the same principle as the security-invariant tests from the original build, now enforced at the database layer as well as the application layer.
- **Never trust RLS alone — defense in depth is required.** Application-layer queries still scope explicitly by the caller's business/client id, exactly as the original `getCallerClient`-style pattern did. RLS is the backstop that catches a missed application-layer check, not a replacement for having one.
- **`service_role` (the key that bypasses RLS entirely) is never exposed to the frontend, ever.** It exists only in server-side/backend code, never committed to a repo, never logged, rotated immediately if it's ever suspected of exposure.
- **Storage buckets are private by default.** A bucket is only made public after a deliberate decision that its contents are genuinely meant to be publicly readable (e.g. published catalog images) — never as a default or for convenience. File paths that encode a tenant/business id are not sufficient protection on their own if the bucket itself is public.
- **Database functions/RPCs callable via the public API must themselves check authorization** — a function being "just business logic" doesn't exempt it from checking who's calling it.
- **The RLS policy for a table's owner/business relationship (`auth.uid()` equivalent checks) should be written once per relationship shape and reused** — inconsistent, ad hoc policies per table are how gaps get introduced. Prefer a small number of well-tested policy patterns applied consistently over bespoke policies per table.
- **Run an automated RLS/security scan before every real deployment**, not just before launch — this is cheap and catches exactly the class of mistake (a forgotten policy on a new table) that's easy to miss in manual review.

---

## 2. Multi-tenancy & general security

- **Every application-layer query/mutation that touches client data is scoped by the caller's business/client id**, resolved from the authenticated session — never from a client-supplied argument. This exists independently of and in addition to RLS (see §1).
- **Admin/privileged actions require an explicit operator-role check as their first action**, validated server-side — never inferred from the frontend.
- **Whitelist, don't blacklist, for constrained values** — enabled modules, roles, statuses, size types, contact preferences — filter incoming values against a known-good allowlist.
- **Never leak which factor of an auth attempt failed**, with one documented, narrow exception: a message revealing account state (e.g. "please verify your email") is permitted only when it surfaces _after_ successful password validation — never before, since that would let an unauthenticated guesser enumerate accounts. Any such exception must be explicitly noted in the code and in this document, not silently introduced.
- **Rate-limit auth endpoints** — sign-in, password reset, invite-link claim.

---

## 3. Auth (Supabase Auth — NOT Better Auth, per ADR-0001)

> Decision of record: Klara uses **Supabase's own Auth**, not Better Auth. Reason: RLS policies rely on `auth.uid()` reading Supabase's own JWT; Better Auth issues a differently-shaped token, so bridging it would require an adapter layer — exactly the fragility that broke the v1 Convex build. Roles/teams are handled by a hand-rolled `organization_members` table, not Better Auth's organization plugin. Any reintroduction of Better Auth is drift — reconcile against ADR-0001 before proceeding.

- **Session persistence on page refresh is a required, explicitly tested behavior**, not an assumption. The previous build shipped with sessions dying on refresh; verify this explicitly (sign in, hard-refresh, confirm the session survives) before considering any auth work done.
- **The invite-link claim flow is single-use.** A claimed link revisited must show a clear "already claimed, please sign in" state, never silently re-processing or erroring unclearly. **Known, accepted limit:** Supabase's invite token is itself single-use, so a second visit always fails token verification regardless of whether it was previously claimed — there's no way to identify the token's owner from that failure alone, and an earlier attempt to infer it from "does this browser currently have an active session" was reverted: any signed-in active user satisfies that check, not just the one who originally claimed this specific link, so it was incorrectly signing out and misinforming unrelated users (e.g. an owner testing a stale invite link while signed into their own account). A revisited link (claimed or not) now always reads as "invalid or expired," with no active session ever torn down as a side effect of visiting `/auth/confirm`. This is a deliberate trade-off — a less specific message over a correctness/security bug — not an oversight.
- **Possessing a valid, unexpired invite link/token is treated as equivalent proof of email control** for the purposes of exempting that specific flow from separate email verification — this is a deliberate, narrow, documented exception, not a general relaxation of verification requirements.
- **Roles (owner/manager/staff or equivalent) are enforced at both layers:** the hand-rolled `organization_members` table for identity/membership (a user's role lives on their membership row), and RLS policies (plus views/application filtering for column-level restrictions) for actual data access. A role existing in the membership layer with no corresponding RLS enforcement is an incomplete implementation, not a finished one.
- **Deferred post-auth actions:** never fire a backend action immediately in the same handler right after sign-up/sign-in/invite-claim — auth state needs a moment to be genuinely ready. Defer (e.g. via `sessionStorage`) and execute once the app's own confirmed auth state (not just the auth library's optimistic state) is ready.

---

## 4. Configuration over customization

- **No per-client code branches.** Per-client and per-vertical variation is expressed as configuration/data consumed by shared code — a reviewer seeing a client-specific or vertical-specific `if` branch in application logic should reject it.
- **Vertical-specific depth is achieved via static, operator-authored registries** (e.g. the Catalog Material Type registry, the module registry, per-module educational content) — a fixed list the operator maintains in code, versioned with a deploy, never user-editable at runtime and never a database table unless there's a genuine runtime-editability need.
- **If a variation cannot be expressed as configuration, it's a new module, not a code fork.**

---

## 5. Data model conventions

- **Many-to-many relationships use a join table**, not an array of ids on a record, whenever efficient bidirectional/filtered lookup matters or per-relationship metadata (like `clientModules`'s `tier`/`featured`/`enabledAt`) is needed.
- **Every table queried by a field has a corresponding index** for that access pattern.
- **Deleting a record cleans up its dependent join rows and stored files** — no orphans.
- **Soft-delete (draft/published/archived) is distinct from hard delete** — "hide" is reversible, "delete" is confirmed and irreversible.
- **A re-provisioned/reactivated record preserves existing data by default** unless a fresh start is the explicit, deliberate design (e.g. a churned client's data is restored on reactivation, not wiped) — confirm intent explicitly rather than assuming either direction.
- **A "success" state must reflect what actually persisted.** Before marking any write-operation UI as successful, verify the claimed change is actually reflected in the data — a UI showing success while silently dropping a field update is a known, real failure mode to guard against explicitly.

---

## 6. Frontend conventions

- **shadcn-svelte components, installed via the CLI and owned in-repo**, styled through a custom Tailwind `@theme` preset (colors, fonts, radius) established before real screens are built — never shadcn's unstyled defaults in a finished screen.
- **Svelte 5 runes throughout** (`$state`, `$props`, `$derived`, `$effect`) — no legacy reactive syntax.
- **Internal route links use the framework's route-resolution helper for literal, known routes; dynamically-computed hrefs use a plain string** and accept the resulting lint warning — the resolver cannot type-check a data-driven path.
- **No nested interactive elements** (e.g. a button inside a button) — browsers repair invalid DOM nesting in ways that break framework assumptions.

---

## 7. Development workflow — visual-first

- **UI is built in two phases, as two distinct ticket types:**
  1. _Static UI ticket_ — components assembled from Figma designs, placeholder content, no backend wiring, no automated tests (nothing to test yet), reviewed on visual/flow fidelity.
  2. _Wire-logic ticket_ — connects an existing static screen to real Supabase queries/mutations, tested per §9's protocol.
- **Don't skip the static phase to save a step.** Assembling real, clickable UI with placeholder data before wiring logic is what allows a genuine visual/flow review before backend investment — the previous build's UX issues came partly from skipping this.

---

## 8. Deployment & infra hygiene

- **Sentry, Vercel, and the deploy pipeline are set up and verified immediately** — a real deployed test (not just "the SDK installed without error") — before feature work depends on them. Every new surface (a new part of the stack Sentry should observe) is verified live the moment it's added, not assumed to work.
- **Deploy/CI credentials are scoped to least privilege** — a build key gets only what a build needs (e.g. deploy + read env), never data-read/write, admin, or destructive permissions — regardless of which platform issues the credential.
- **Environment-dependent code must not crash on a fresh clone or in CI** — e.g. code that reads a local env file must handle that file not existing yet, rather than assuming a locally-configured environment.
- **Sender/credential values (email sender addresses, API keys) are always read from environment variables, never hardcoded**, and fail loudly (not silently) if misconfigured — a sandbox/placeholder value silently shipping to production is a known, real failure mode.

---

## 9. Testing & review protocol

Two distinct verification layers, stacked, not overlapping:

**Layer 1 — automated tests (correctness).** Written test-first, one behavior at a time, targeting the public interface/seam. For Klara specifically, the highest-value tests are the security invariants: a caller cannot read/modify another business's data (tested at _both_ the RLS layer and the application layer per §1), an unauthenticated/unauthorized call is rejected, server-side validation rejects tampered input, admin-gated actions reject a missing/wrong role. RLS policies specifically must have explicit denied-access tests, not just allowed-access tests.

**Layer 2 — independent review (judgment).** The tool that writes code shares its own blind spots reviewing it. In-session `code-review` (Standards + Spec axes, kept separate) runs first and catches the obvious; **Greptile reviews the actual PR independently**, pointed at this document as its ruleset, and catches what the implementer is structurally blind to.

**Gate order, per ticket:** implement (tests green) → in-session code-review → PR opens → Greptile review → human merge decision. Human (operator) holds final merge authority always.

---

## 10. Scope discipline

- **Build against a real client's need**, not speculatively — the prospect list is the forcing function.
- **A second vertical's configuration (e.g. a new Material Type registry) is added when a real client needs it**, using the seam already designed for it (§4) — not built out preemptively.
- **Automation engine and self-serve module activation are explicitly deferred** — don't let them creep into an earlier module's scope.
- **A module connects to the business's live website as part of being built, not as separately-deferred scope** — an admin-only module a client can't actually put in front of their own customers isn't finished. Whether a given module needs a public-facing surface (and how much) is still governed by the first bullet above (build against the real client's actual need) — it's just no longer treated as a categorically later phase.
- **Subscription billing (Polar) and human-service billing (site builds, domains) stay strictly separate.**

---

## 11. How this document is used

This is a living constitution. Every new real bug or judgment call that gets resolved deliberately (not silently) gets added here — the same way the invite-link verification exception and the EMAIL_NOT_VERIFIED carve-out were documented rather than assumed. When a rule proves wrong, it's changed deliberately, with reasoning, not quietly ignored.

---

## 12. Public API surface for client-site integration

> Decision of record: [ADR-0008](./adr/0008-public-api-surface-per-module.md). Simmo builds each client's real website as a separate project, not a Klara-hosted page — that site still needs to submit into Klara (a booking, an order, an inquiry) without becoming a Klara page itself. This section formalizes the resulting pattern so every module built after Bookings picks it up by default rather than re-deriving it.

- **Every module needing external-site integration exposes a versioned REST endpoint** at `src/routes/api/v1/{module}/[orgSlug]/+server.ts` — GET for reads, POST for writes — **in addition to**, not instead of, any page-action-based public route Klara hosts itself for that module. The two are separate entry points into the same operation, not alternatives to choose between.
- **CORS is never hardcoded per module or per client.** Every such endpoint resolves the organization from the URL slug, then checks the request's `Origin` header against that org's `organizations.allowed_origins` (text array — a client's site commonly needs more than one trusted origin at once, e.g. production + staging) and rejects anything not on the list. A hardcoded allowed-origin string is the same class of mistake §4 already forbids for application logic, applied to CORS specifically.
- **Every public write endpoint follows the same security shape already established for Bookings' `/book/[orgSlug]` routes:** resolve the org from the URL slug (never a client-supplied org id), check origin, rate-limit, then write via the service-role client. The endpoint's own logic is the entire security boundary for that path.
- **Shared logic is extracted into reusable server-side functions called from both entry points — never duplicated between the page action and the API endpoint.** Org resolution, customer find-or-create, and rate-limiting are the recurring examples; a fix applied to one entry point and not the other is the direct, foreseeable cost of skipping this.
- **`allowed_origins` is fail-closed** — an unset or empty allowlist means every cross-origin request to that org's endpoints is rejected, never silently permitted.
