# Klara

Klara is a multi-tenant SaaS "digital operating system" for small businesses, giving each business a portal to manage their website, content, and operations through toggleable modules.

## Language

**Operator**:
The platform owner running Klara itself — provisions clients, assigns modules, and has access to the Admin portal. Identity tracked in a standalone `operators` table, independent of any business's `organization_members`. Not a role within a business.
_Avoid_: Admin (ambiguous with "admin portal" and with a business's own `manager`/`owner` roles), superuser.

**Client portal**:
The surface a business uses to manage their own content, customers, and operations. Guarded by the `(protected)` route group.
_Avoid_: Dashboard (that's a specific route within the client portal, not the surface itself), app.

**Admin portal**:
The surface the Operator uses to manage all clients — provisioning, module assignment, read-only support access to a client's dashboard. Guarded by the `(admin)` route group, independent of the client portal's guard.
_Avoid_: Backend, ops panel.

**Membership**:
An `organization_members` row linking a user to a business with a fixed `role` (owner/manager/staff) and a `status` (`pending` | `active`). Created at invite time with `status: pending`; flipped to `active` (with `claimed_at` set) when the invite is claimed.
_Avoid_: Account (a user may hold zero, one, or more memberships; "account" conflates the two).

**Claim**:
The act of an invited user completing the invite-link flow: exchanging Supabase's invite token for a session, then setting a password. Single-use — a claimed link revisited must show "already claimed, please sign in," never re-process silently.
_Avoid_: Activate, accept (reserve "activate" for the resulting `status: active`, not the act itself).

### Catalog

**Material Type**:
A structural classification for a catalog item (Jersey, Shoes, Belt, etc.) — one per item, drawn from a static, code-owned registry (never client-created). Drives which fields and size scheme the shared item form renders; not to be confused with Category.
_Avoid_: Product type, category (Material Type is structural/one-per-item; Category is merchandising/many-per-item — see ADR-0004).

**Category**:
A client-authored merchandising tag (e.g. Male, Kids, Jerseys) used for browsing/filtering, not for driving the item form. Two levels (a category and, optionally, one level of subcategory below it); an item can carry multiple categories at any level simultaneously. Unlike Material Type, there is no shared static registry — each organization manages its own category tree (ADR-0004).
_Avoid_: Tag alone (used loosely elsewhere; within Catalog, "Category" is the precise term), Material Type.

**Catalog Item**:
A single product listing belonging to one organization: name, description, price, one Material Type, zero or more Categories, one or more images (one marked primary), a size-driven Stock record, and a lifecycle status (`draft` | `published` | `archived`, with `archived` always reversible back to `draft`).

**Stock**:
The available quantity of a Catalog Item at a given size (or, for sizeless Material Types, the item as a whole). Recorded per `(item, size)` pair, not embedded in the Material Type's size scheme — the size scheme says which sizes exist for a type; Stock says how many of each a specific item currently has.
_Avoid_: Inventory (reserve for a possible future, more general inventory-management feature; Stock here is scoped specifically to Catalog items).

### Bookings

**Resource**:
A bookable thing scoped to one organization: either a Provider (recurring weekly availability) or an Inventory Unit (a pool of interchangeable capacity). `resourceType` stays exactly these two values — a variant availability model (e.g. optional/uncapped capacity) is expressed as configuration on an Inventory Unit, not a third `resourceType` (Standards §4; see ADR-0006).

**Uncapped resource**:
An Inventory Unit resource with `quantity: null` — no hard capacity ceiling. Conflict-check never rejects a booking for such a resource on capacity grounds; it functions purely as a request log.
_Avoid_: Unlimited (implies a deliberate design choice per-booking; "uncapped" names the resource's configured state).

A Resource has a lifecycle status (`draft` | `published` | `archived`, with `archived` always reversible back to `draft`) — same shape as Catalog Item, for the same reason: it's dual-purpose (an agent's private working view vs. the public page customers see), and only `published` resources are publicly visible.

**Travel Inquiry**:
A customer's request for the agent to design a custom trip, with no existing Resource to book — upstream of and structurally separate from a Booking (which always references a specific Resource). May later be converted into a real Resource + Booking by the agent, but isn't one itself.
_Avoid_: Booking, Request (both already mean something specific and resource-bound in this context).
