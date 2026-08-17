-- ============================================================
-- P0 RBAC helpers and membership hardening
-- Captures the role model and organization-level policy changes
-- that were applied directly in Supabase during P0.
-- ============================================================

-- Normalize the one known historical role before adding the stricter role check.
update public.organization_members
set role = 'viewer'
where role = 'member';

do $$
begin
  if exists (
    select 1
    from public.organization_members
    where role not in ('owner', 'admin', 'procurement', 'approver', 'viewer')
  ) then
    raise exception 'Unknown organization_members.role values exist; review and map them before applying P0 RBAC constraints.';
  end if;
end $$;

alter table public.organization_members
alter column role set default 'viewer';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_role_check'
  ) then
    alter table public.organization_members drop constraint organization_members_role_check;
  end if;

  alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'procurement', 'approver', 'viewer'));
end $$;

-- Role helpers used by RLS and SECURITY DEFINER RPCs.
create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner', 'admin']);
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner']);
$$;

create or replace function public.can_manage_procurement(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner', 'admin', 'procurement']);
$$;

create or replace function public.can_approve(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner', 'admin', 'approver']);
$$;

create or replace function public.can_manage_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner', 'admin']);
$$;

-- Explicit helper privileges.
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.can_manage_procurement(uuid) from public;
revoke all on function public.can_approve(uuid) from public;
revoke all on function public.can_manage_organization(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from anon;
revoke all on function public.is_org_admin(uuid) from anon;
revoke all on function public.is_org_owner(uuid) from anon;
revoke all on function public.can_manage_procurement(uuid) from anon;
revoke all on function public.can_approve(uuid) from anon;
revoke all on function public.can_manage_organization(uuid) from anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.can_manage_procurement(uuid) to authenticated;
grant execute on function public.can_approve(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;

-- Harden organization membership policies.
alter table public.organization_members enable row level security;

drop policy if exists "Users can read their memberships" on public.organization_members;
drop policy if exists "Authenticated users can create memberships for themselves" on public.organization_members;
drop policy if exists "Members can update organization memberships" on public.organization_members;
drop policy if exists "P0 members can read organization memberships" on public.organization_members;
drop policy if exists "P0 owner admin can insert organization memberships" on public.organization_members;
drop policy if exists "P0 owner admin can update organization memberships" on public.organization_members;
drop policy if exists "P0 owners can delete non-owner organization memberships" on public.organization_members;

create policy "P0 members can read organization memberships"
on public.organization_members for select
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

create policy "P0 owner admin can insert organization memberships"
on public.organization_members for insert
with check (
  public.can_manage_organization(organization_id)
  and role <> 'owner'
);

create policy "P0 owner admin can update organization memberships"
on public.organization_members for update
using (
  public.can_manage_organization(organization_id)
  and role <> 'owner'
)
with check (
  public.can_manage_organization(organization_id)
  and role <> 'owner'
);

create policy "P0 owners can delete non-owner organization memberships"
on public.organization_members for delete
using (
  public.is_org_owner(organization_id)
  and role <> 'owner'
);

-- Harden organization and organization_settings writes.
drop policy if exists "Members can update their organizations" on public.organizations;
drop policy if exists "P0 owner admin can update organizations" on public.organizations;

create policy "P0 owner admin can update organizations"
on public.organizations for update
using (public.can_manage_organization(id))
with check (public.can_manage_organization(id));

drop policy if exists "Org members can insert organization_settings" on public.organization_settings;
drop policy if exists "Org members can update organization_settings" on public.organization_settings;
drop policy if exists "Org members can delete organization_settings" on public.organization_settings;
drop policy if exists "P0 owner admin can insert organization_settings" on public.organization_settings;
drop policy if exists "P0 owner admin can update organization_settings" on public.organization_settings;
drop policy if exists "P0 owner admin can delete organization_settings" on public.organization_settings;

create policy "P0 owner admin can insert organization_settings"
on public.organization_settings for insert
with check (public.can_manage_organization(organization_id));

create policy "P0 owner admin can update organization_settings"
on public.organization_settings for update
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create policy "P0 owner admin can delete organization_settings"
on public.organization_settings for delete
using (public.can_manage_organization(organization_id));
