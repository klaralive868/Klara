# Catalog module

Admin-side product catalog management for the clothing vertical. An organization's owner/manager/staff can create, edit, categorize, photograph, stock, and publish product listings ("Catalog Items"). No public storefront yet — this module is scoped to management only; browsing/filtering by a real customer is a separate, later slice.

Built across 8 tickets tracked under parent issue [#11](https://github.com/klaralive868/Klara/issues/11), all merged to `main`. Backed by two ADRs: [0004](./adr/0004-catalog-categories-client-authored.md) (categories are client-authored, not a static registry) and [0005](./adr/0005-catalog-images-private-no-public-read.md) (images are private, no public read access in this build).

## Domain model

| Term | Meaning |
|---|---|
| **Material Type** | A structural classification (Jersey, Shoes, Belt, …) — one per item, drawn from a static, code-owned registry. Drives which fields/size scheme the shared item form renders. Never client-created. |
| **Category** | A client-authored merchandising tag (Male, Kids, Jerseys, …) — many per item, at any of two levels. Drives browsing/filtering (once a storefront exists), not the form. Each organization owns its own category tree. |
| **Catalog Item** | One product listing: name, description, price, one Material Type, zero-or-more Categories, one-or-more Images (one primary), per-size Stock, and a lifecycle status. |
| **Stock** | Quantity of an item available at a given size (or, for sizeless types, the item as a whole). Recorded per `(item, size)`, independent of the Material Type's size *scheme* — the scheme says which sizes exist; Stock says how many of each this item has. |

Full glossary entries live in [`CONTEXT.md`](../CONTEXT.md).

### Material Type registry

Static TypeScript module: [`src/lib/catalog/material-types.ts`](../src/lib/catalog/material-types.ts). 12 types across 4 sizing schemes:

| Scheme | Types | Sizes |
|---|---|---|
| `standardTops` | Jersey, Shirt, Dress, Underwear | XS, S, M, L, XL, 2XL |
| `standardBottoms` | Shorts, Jeans, Skirt, Belt | 28, 30, 32, 34, 36, 38, 40 |
| `gendered` | Shoes, Slides | Male: 7–13, Female: 5–10 |
| `none` | Sunglasses, Socks | — (single quantity, no per-size breakdown) |

Common set shown by default in the picker: Jersey, Shirt, Shorts, Shoes, Jeans. The rest sit behind a "+ More materials" modal. `client_modules.tier` (currently only `'clothing'`) is the seam a future second vertical's registry would hang off — no second registry is built.

## Data model

Five tables plus the pre-existing `catalog_items`, all `snake_case` in Postgres, RLS-scoped, deny-by-default beyond what's explicitly granted.

```
catalog_items
├── catalog_item_categories ──── catalog_categories (client's own tree, 2 levels)
├── catalog_item_images (Storage-backed)
└── catalog_item_stock
```

| Table | Migration | Key columns | Notes |
|---|---|---|---|
| `catalog_items` | `20260721194500` | `organization_id` (default `current_organization_id()`), `name`, `description`, `price_cents`, `material_type`, `status` | `status` ∈ `draft` \| `published` \| `archived`. `material_type` references the code registry by key — not a DB table. |
| `catalog_categories` | `20260721225030` | `organization_id`, `name`, `parent_id` (self-referencing, nullable) | Exactly two levels, enforced by a trigger (below). |
| `catalog_item_categories` | `20260721225030` | `item_id`, `category_id` | Many-to-many. **No** `organization_id` column — see [RLS design](#rls-design-exists-not-denormalized). |
| `catalog_item_images` | `20260722065742` | `item_id`, `storage_path`, `is_primary` | Partial unique index guarantees ≤1 primary per item. |
| `catalog_item_stock` | `20260722073313` | `item_id`, `size` (nullable), `quantity` | Two partial unique indexes cover the nullable-size case (see below). |

### Storage

Private bucket `catalog-images` (`public: false`), path convention `{organization_id}/{item_id}/{image_id}.{ext}`. No public read policy exists at all — the app reads via server-generated signed URLs (1 hour expiry) at page-load time. RLS on `storage.objects` scopes by the path's first segment matching the caller's org.

### RLS design: EXISTS, not denormalized

`catalog_item_categories`, `catalog_item_images`, and `catalog_item_stock` all scope their RLS policies via:

```sql
using (
  exists (
    select 1 from public.catalog_items
    where catalog_items.id = <table>.item_id
    and catalog_items.organization_id = public.current_organization_id()
  )
)
```

This was a deliberate correction mid-build. The obvious alternative — a denormalized `organization_id` column with `with check (organization_id = current_organization_id())` — is spoofable: **foreign-key existence checks bypass RLS**, so a caller could set `organization_id` to their own org while `item_id`/`category_id` pointed at another organization's row, and the FK would still be satisfied. The `EXISTS` form ties every write to a column (`catalog_items.organization_id`) that's independently trustworthy. Found and fixed while writing `catalog_item_categories`'s pgTAP tests; the same class of bug was then proactively fixed in the category-depth trigger (below) and applied from the start to images and stock.

### Structural invariants enforced by triggers

- **Category max depth** (`enforce_catalog_category_max_depth`, on `catalog_categories`): a category may only nest under a *top-level* category. Runs `SECURITY INVOKER` deliberately — the lookup is RLS-scoped, so a `parent_id` belonging to another organization resolves to "not found," not "silently allowed." (An earlier version conflated "parent not visible to me" with "parent is top-level," both reading as a null grandparent — fixed with a regression test.)
- **First-upload auto-primary** (`set_first_catalog_item_image_primary`, `BEFORE INSERT` on `catalog_item_images`): the first image uploaded for an item is automatically marked primary, regardless of which client performs the insert.
- **Promote-next-primary** (`promote_next_catalog_item_image_primary`, `AFTER DELETE` on `catalog_item_images`): if the row just deleted held the primary spot, the oldest remaining image for that item is promoted. Without this, removing the primary image left an item with images but none marked primary.
- **Nullable-size uniqueness** (`catalog_item_stock`, two partial unique indexes): a plain `unique(item_id, size)` doesn't work when `size` is nullable — Postgres treats every `NULL` as distinct, which would let multiple "sizeless" rows pile up for one item. Split into `unique(item_id, size) where size is not null` and `unique(item_id) where size is null`.

### Atomic RPCs

Several operations need more than one write to stay consistent, and a bare sequence of two client-side calls risks a partial-failure window (first write commits, second fails, caller sees an error but data already changed). Each of these wraps its writes in a single Postgres function call — one transaction, one round trip:

| Function | Does | Why atomic matters |
|---|---|---|
| `sync_catalog_item_categories(item_id, category_ids)` | Replace-all: delete existing tags, insert the given set | A failed insert after the delete would leave the item with zero tags. |
| `sync_catalog_item_stock(item_id, entries)` | Replace-all: delete existing rows, insert entries with `quantity > 0` | Same failure mode as above, for stock. |
| `publish_catalog_item(item_id, category_ids)` | `UPDATE status = 'published' WHERE status = 'draft'`, then (only if that matched) calls `sync_catalog_item_categories` internally | Originally two separate calls; a failed sync after a committed status flip left an item published-in-the-DB but shown-as-draft in the UI, with every retry then 404ing against the now-stale `WHERE status = 'draft'` guard. The status check runs *first* and gates the sync, so a non-draft item's tags are never touched by an invalid publish attempt. |
| `mark_catalog_item_image_primary(image_id)` | Unmarks the current primary (if any) for that item, marks the given image | Avoids a window with zero — or, on partial failure, two — primary images. |

All four are `SECURITY INVOKER` (the default, stated explicitly in each migration) — they run under the caller's own RLS, granting no privilege the caller didn't already have via the underlying table policies.

## Business rules

- **Publish gating**: an item needs ≥1 category to be published. Enforced server-side in the `publish` action, checked *before* any write — an unpublishable attempt leaves the item's existing tags and stock untouched. Not a DB constraint (cross-table rule, better suited to application logic — Standards §1).
- **Draft-only publish/unarchive**: both transitions are guarded with a `WHERE status = '<expected>'` precondition, so a direct POST to either action can't force an unexpected state jump (e.g. published → draft via a stale `?/unarchive` request).
- **Archive is always reversible**: `archived → draft` via unarchive, never a dead end.
- **Scheme-switch stock reconciliation**: switching an item's Material Type resets the client-side stock form to the new scheme's sizes; saving then replace-all-syncs, so the old scheme's rows are dropped "for free" without dedicated reconciliation logic.
- **Direct-Publish-without-Save**: the `publish` action reads `categoryIds` *and* `stockQuantities` from its own form submission (not just prior DB state) — clicking Publish without clicking Save item first still persists whatever was just checked/entered, rather than silently discarding it.
- **Image uploads are all-or-nothing per batch**: if file 2 of 3 fails mid-upload, files already committed in that same call (storage object + DB row) are rolled back rather than left in place — otherwise a retry would duplicate them.
- **5MB per-file image size limit**, checked before any storage/DB write.

## Routes and actions

| Route | Purpose |
|---|---|
| `GET /dashboard/catalog` | Item list, scoped to caller's org via RLS. |
| `GET/POST /dashboard/catalog/new` | Create form. Action `default`: creates the item (always `draft`), tags categories, syncs stock. No image upload here — a Storage path needs a real `item_id`. |
| `GET/POST /dashboard/catalog/[id]/edit` | Edit form. Actions: `update`, `publish`, `archive`, `unarchive`, `uploadImages`, `setPrimaryImage`, `removeImage`. |
| `GET/POST /dashboard/catalog/categories` | Category management. Actions: `createTopLevel`, `createSubcategory`, `rename`, `delete`. |

Shared UI: [`CatalogItemForm.svelte`](../src/lib/components/catalog/CatalogItemForm.svelte) composes `MaterialTypePicker`, `StockSelector`, `CategoryTagger`, and (edit-only) `ImageUploader` — one form, never forked per Material Type.

## Testing

| Layer | Coverage |
|---|---|
| Vitest (unit) | Material Type registry invariants, `parseCatalogItemForm`/`parseStockQuantities` (dollars→cents rounding, malformed input, zero/negative quantities). |
| pgTAP (RLS) | `supabase/tests/0005`–`0009` — 5 files, own-org read/write allowed, cross-org read/write denied for every table, plus regression tests for the max-depth trigger, the EXISTS-vs-denormalized fix, and the promote-next-primary trigger. |
| Playwright (e2e) | `catalog-item-crud`, `catalog-categories`, `catalog-images`, `catalog-stock` — create→edit→persist flows, publish gating (blocked then allowed), first-upload-auto-primary, re-mark primary, scheme-switch reconciliation, and a cross-organization denied-access check per module, exercised through the real UI/session (not mocked). |

Each spec file uses its own dedicated e2e test user (`CATALOG_OWNER_EMAIL`, `CATEGORIES_OWNER_EMAIL`, `IMAGES_OWNER_EMAIL`, `STOCK_OWNER_EMAIL`) so parallel sign-ins don't share a rate-limit bucket across files.

## Real test data (production)

Two organizations exist against the production Supabase project, per the tracer-bullet approach:

- **Klara Operator** — `business@klara.live` (owner + platform operator)
- **Netbreakerz** — `keagan@klara.live` (owner), `client_modules` row set to `catalog` / `clothing`

## Out of scope (this build)

- Public storefront browsing/filtering by category
- Public read access to catalog images (deferred to the storefront module — ADR-0005)
- Per-size pricing (price is set once per item)
- SKU / item codes
- Multi-currency support
- General-purpose inventory management (purchase orders, supplier tracking, low-stock alerts) — Stock here is scoped to Catalog items only
- A second vertical's Material Type registry (the `client_modules.tier` seam is left in place; only `clothing` is built)
