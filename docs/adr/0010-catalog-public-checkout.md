# ADR-0010: Catalog gets a public API and checkout, resolving the images/stock-exposure questions ADR-0005 deferred

- Status: Accepted
- Date: 2026-07-30

## Context

Netbreakerz needs a real public storefront: browse published catalog items and check out against real stock, the same way WorldView's storefront already calls Bookings' public API (ADR-0008). Building this forces two decisions ADR-0005 (catalog-images bucket, kept private) explicitly deferred to "the storefront module's own grilling session" — that session is now.

## Decisions

**Catalog images become public.** The `catalog-images` bucket flips from `public: false` to `public: true` (`20260730070000_catalog_images_public.sql`) — same reasoning ADR-0007 used for `resource-images`: a real, concrete public consumer now exists, which is the bar ADR-0005 asked for before revisiting its private-by-default stance. No RLS changes were needed or possible: a public bucket serves GET/download requests through Supabase Storage's public-object endpoint without evaluating `storage.objects` RLS at all. Same accepted looseness ADR-0007 flagged for `resource-images`: any uploaded image becomes fetchable the moment it exists, regardless of its item's draft/published/archived status — not new risk, the same tradeoff applied here.

**Stock is exposed as booleans, never exact counts.** `GET /api/v1/catalog/{orgSlug}/items` and `.../items/{id}` return `stockBySize: Record<string, boolean> | null` (in-stock per size; `null` for a sizeless item — check `inStock` instead) plus a top-level `inStock: boolean`. This isn't a fresh call — it mirrors Bookings' own public API, which already withholds `quantity`/`requiresManualConfirmation` as agent-only (`public-resources.ts`). A storefront needs "can I buy this," not the warehouse number; exact retail counts are competitively sensitive in a way a boolean isn't.

One structural note this decision inherits rather than introduces: `catalog_item_stock` only ever persists rows with `quantity > 0` (`sync_catalog_item_stock`'s own `WHERE quantity > 0`). A size that was never offered and a size that's currently sold out are indistinguishable — both simply have no row. `stockBySize` faithfully reflects that existing limitation; it doesn't paper over it.

**Per-item stock is either capped or unlimited**, a per-item flag (`catalog_items.unlimited_stock`, not a per-size concept): unlimited items always accept checkout regardless of quantity, agent reconciles availability manually (mirrors Bookings' "capacity never blocks" philosophy for uncapped resources).

**Atomicity is two Postgres functions, not JS-orchestrated rollback.** `decrement_item_stock(item_id, size, quantity)` is a small, independently-testable primitive — one conditional `UPDATE ... WHERE quantity >= p_quantity`, atomic via Postgres's own row-level locking on the statement, not a separate check-then-write pair. `checkout_cart(...)` calls it once per cart line **inside its own plpgsql body** — a function call doesn't open a new transaction, so every decrement plus the final `orders` insert share the same transaction as the outer call. Any insufficient-stock line raises immediately, unwinding every earlier decrement in that same checkout automatically. This is why a genuine concurrency test (two simultaneous checkouts racing for the last unit) needed a real Postgres instance to prove — see "Testing" below.

Both functions are `SECURITY INVOKER`, not `DEFINER`: they're only ever called via the service-role admin client (which already bypasses RLS and holds full grants), matching this repo's existing RPC convention (`sync_catalog_item_stock`, `mark_resource_image_primary`).

**Checkout returns the order id.** Unlike Bookings/Inquiries (pure fire-and-forget requests, deliberately no id returned), `checkout_cart` already produces the new order's id as part of the insert — returning it in `{data: {success: true, orderId}}` is free here and more justified: an order is something a customer may reference later.

## Testing

This introduces the repo's first test tier that requires a real (non-mocked) Postgres instance: `npm run test:integration` (`vitest.integration.config.ts`, `src/**/*.integration.test.ts`), kept separate from `npm run test:unit` so the existing 100%-fake-client suite's contract with CI/contributors doesn't silently change. The race condition this module cares about most — two concurrent checkouts for the last unit, exactly one must succeed — genuinely cannot be demonstrated against a mocked client; it needs real MVCC row-locking.

## Consequences

- Order creation is closed-provisioning, same shape as `organizations`/`client_modules`: no `authenticated` insert policy on `orders` exists — an order is only ever created via checkout's service-role path, never directly by a dashboard user.
- `customers.source` gains `'order'` (drop/re-add `customers_source_check`, same pattern `20260728010000` used for `'inquiry'`).
- No detail/status-change UI for orders this pass — `/dashboard/orders` is a list only, explicitly time-boxed; changing an order's status from the dashboard is a follow-up.
