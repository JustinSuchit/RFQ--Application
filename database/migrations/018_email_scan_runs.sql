create table if not exists public.email_scan_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_connection_id uuid not null references public.email_connections(id) on delete cascade,
  trigger text not null,
  provider text not null,
  folder text,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  scanned_count integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  skipped_not_rfq_count integer not null default 0,
  attachment_count integer not null default 0,
  error_message text,
  highest_uid bigint,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_scan_runs_trigger_check'
  ) then
    alter table public.email_scan_runs
    add constraint email_scan_runs_trigger_check
    check (trigger in ('manual', 'scheduled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'email_scan_runs_status_check'
  ) then
    alter table public.email_scan_runs
    add constraint email_scan_runs_status_check
    check (status in ('running', 'success', 'failed', 'partial'));
  end if;
end $$;

create index if not exists idx_email_scan_runs_org_connection_started
on public.email_scan_runs(organization_id, email_connection_id, started_at desc);

create index if not exists idx_email_scan_runs_org_status_started
on public.email_scan_runs(organization_id, status, started_at desc);

alter table public.email_scan_runs enable row level security;

drop policy if exists "Org members can select email_scan_runs" on public.email_scan_runs;
create policy "Org members can select email_scan_runs"
on public.email_scan_runs for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_scan_runs" on public.email_scan_runs;
create policy "Org members can insert email_scan_runs"
on public.email_scan_runs for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_scan_runs" on public.email_scan_runs;
create policy "Org members can update email_scan_runs"
on public.email_scan_runs for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
