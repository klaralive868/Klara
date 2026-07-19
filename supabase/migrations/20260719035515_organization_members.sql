-- Core tenancy: organizations (businesses) + their members.
-- Schema follows ADR-0002 (membership rows created pending at invite time)
-- and Standards §1 (RLS enabled from the moment a table is created, no
-- permissive USING(true) policies, deny-by-default for writes).

-- ============================================================
-- organizations
-- ============================================================
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ============================================================
-- organization_members
-- ============================================================
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.member_status as enum ('pending', 'active');

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role            public.member_role not null,
  status          public.member_status not null default 'pending',
  claimed_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, organization_id)
);

alter table public.organization_members enable row level security;

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_organization_id_idx on public.organization_members (organization_id);

-- ============================================================
-- current_organization_id() — the policy pattern, written once, reused
-- everywhere a policy needs "the caller's own organization" (Standards §1).
-- Only resolves to an ACTIVE membership: a pending member has no organization
-- visible to them yet, by design (they're forced through set-password first).
-- ============================================================
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- ============================================================
-- Policies (deny-by-default: no insert/update/delete policies exist here.
-- Writes happen only via service_role in server routes — invite issuance
-- and claim/set-password are both server-side actions. See
-- klara-architecture-brief-v2.md §8 / ADR-0002, closed provisioning model)
-- ============================================================
create policy organizations_select_own
  on public.organizations for select
  to authenticated
  using ( id = public.current_organization_id() );

create policy members_select_own_organization
  on public.organization_members for select
  to authenticated
  using ( organization_id = public.current_organization_id() );

-- ============================================================
-- Grants (RLS policies only take effect after the base table privilege
-- exists — Postgres checks table grants before policies)
-- ============================================================
grant usage on schema public to authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant execute on function public.current_organization_id() to authenticated;

-- service_role bypasses RLS policies, but table-level grants are a separate
-- system — BYPASSRLS does not imply privileges. Invite issuance, the claim
-- flow, and any future admin server routes need full read/write here.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.organization_members to service_role;
