# ADR-0004: Catalog categories are client-authored, not a static registry

- Status: Accepted
- Date: 2026-07-21

## Context

Klara leans heavily on static, code-owned registries for anything structural or educational: the Material Type registry, the module registry, per-module educational content (Architecture Brief §6, §7) — all fixed lists an operator writes once, versioned with a deploy, never user-generated. Catalog's category/tag taxonomy (Male/Female/Kids, "Jerseys" as a browse filter, etc.) looks similar on the surface, so a future reader could reasonably expect it to follow the same static-registry pattern.

It doesn't fit that pattern, though: categories are genuinely per-business. A general clothing retailer's Male/Female/Kids split doesn't generalize to, say, a swimwear-only shop's category needs, in the way "Jersey" and "Shoes" generalize across every clothing business regardless of what they sell.

## Decision

Categories are **client-authored**: each organization manages its own category tree via the admin UI, stored in a normal, RLS-scoped table (`catalog_categories`), not a static code registry. This is the deliberate exception to Klara's usual static-registry default, not an oversight.

Material Type stays a static registry because it's structural — it drives the item form's field/size logic, and the set of clothing material types genuinely doesn't vary by business. Categories stay client-authored because they're merchandising — how a specific business wants to browse/filter their own catalog, which does vary by business.

## Consequences

- `catalog_categories` needs its own CRUD surface in the admin UI (create/rename/delete a category or subcategory) — categories aren't just "picked from a list" the way Material Type is.
- RLS/denied-access testing applies to `catalog_categories` and `catalog_item_categories` the same as every other table — client-authored doesn't mean less scrutiny.
- A future "starter category set" (offered as an editable default when a new organization is provisioned, not a hard registry) is a reasonable future enhancement, not something this decision forecloses.
