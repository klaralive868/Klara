-- Atomically replaces an organization's full client_modules rowset — three
-- separate insert/update/delete calls from the admin action risked the same
-- partial-failure gap fixed for catalog stock (see sync_catalog_item_stock):
-- if a later step failed after an earlier one had already committed, the
-- organization would be left with only a prefix of the operator's requested
-- module configuration. p_entries is a JSON array of {"module": string,
-- "tier": string}.
--
-- SECURITY INVOKER (the default): only ever called via the service-role
-- admin client from admin routes (client_modules writes are deny-by-default
-- for `authenticated` — see client_modules migration), so this doesn't
-- widen who can call it; it just makes what an already-privileged caller
-- does atomic.
create or replace function public.sync_client_modules(p_organization_id uuid, p_entries jsonb)
returns void
language plpgsql
security invoker
as $$
begin
	delete from public.client_modules where organization_id = p_organization_id;

	insert into public.client_modules (organization_id, module, tier)
	select p_organization_id, entry->>'module', entry->>'tier'
	from jsonb_array_elements(p_entries) as entry;
end;
$$;

grant execute on function public.sync_client_modules(uuid, jsonb) to service_role;
