-- ============================================================
-- IMAP Email Connection Settings
-- Generalized mailbox configuration for RFQ email intake
-- ============================================================

create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  mailbox_email text,
  access_token text,
  refresh_token text,
  graph_delta_link text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.email_connections
add column if not exists provider text,
add column if not exists mailbox_email text,
add column if not exists access_token text,
add column if not exists refresh_token text,
add column if not exists graph_delta_link text,
add column if not exists token_expires_at timestamptz,
add column if not exists is_active boolean not null default true,
add column if not exists created_by uuid references auth.users(id) on delete set null,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now(),
add column if not exists imap_host text,
add column if not exists imap_port integer default 993,
add column if not exists imap_secure boolean default true,
add column if not exists imap_username text,
add column if not exists imap_password_encrypted text,
add column if not exists scan_folder text default 'INBOX',
add column if not exists only_unread boolean default false,
add column if not exists last_uid bigint,
add column if not exists last_scan_at timestamptz;

create unique index if not exists idx_email_connections_org_provider
on public.email_connections(organization_id, provider);

create index if not exists idx_email_connections_organization_id
on public.email_connections(organization_id);

drop trigger if exists set_email_connections_updated_at on public.email_connections;
create trigger set_email_connections_updated_at
before update on public.email_connections
for each row execute function public.set_updated_at();

alter table public.email_connections enable row level security;

drop policy if exists "Org members can select email_connections" on public.email_connections;
create policy "Org members can select email_connections"
on public.email_connections for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_connections" on public.email_connections;
create policy "Org members can insert email_connections"
on public.email_connections for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_connections" on public.email_connections;
create policy "Org members can update email_connections"
on public.email_connections for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete email_connections" on public.email_connections;
create policy "Org members can delete email_connections"
on public.email_connections for delete
using (public.is_org_member(organization_id));
