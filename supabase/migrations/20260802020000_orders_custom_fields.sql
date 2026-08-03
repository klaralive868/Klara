-- Orders adopts the generic field_definitions system (ADR-0011), same as
-- Customers — needs somewhere to actually store a custom field's value.
-- No is_core rows exist for entity_type = 'order' (every existing Orders
-- column is structurally intrinsic, not optional business data — enforced
-- already by field_definitions' own check constraint), so this column only
-- ever holds genuinely custom values, same shape/role as
-- customers.custom_fields.
alter table public.orders
	add column custom_fields jsonb not null default '{}';
