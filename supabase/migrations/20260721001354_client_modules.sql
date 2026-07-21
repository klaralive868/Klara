-- Minimal seed of the fuller module-enablement system described in
-- klara-architecture-brief-v2.md §6 (clientModules: enabledAt, featured,
-- request-flow) — deliberately just enough for now to answer "which
-- registry/tier applies to this organization's module," nothing else.
-- module/tier are left as plain text, not enums: valid tier values are
-- module-dependent (only 'clothing' exists today, for 'catalog'), and this
-- table is expected to grow into the fuller shape later rather than be
-- over-constrained now.
create table public.client_modules (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null references public.organizations (id) on delete cascade,
	module text not null,
	tier text not null,
	created_at timestamptz not null default now(),
	unique (organization_id, module)
);

alter table public.client_modules enable row level security;

-- Same policy pattern as organizations/organization_members: a member can see
-- their own organization's module config, nothing else. Deny-by-default for
-- writes — module/tier assignment is operator-provisioned (closed model,
-- Architecture Brief §8), never an app-driven write from the client side.
create policy client_modules_select_own_organization
	on public.client_modules for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select on public.client_modules to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.client_modules to service_role;
