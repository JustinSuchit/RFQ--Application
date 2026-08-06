alter table public.email_connections
add column if not exists auto_scan_enabled boolean not null default false;

alter table public.email_connections
add column if not exists scan_interval_minutes integer not null default 60;

alter table public.email_connections
add column if not exists next_scan_at timestamptz;

alter table public.email_connections
add column if not exists last_scan_status text;

alter table public.email_connections
add column if not exists last_scan_error text;

alter table public.email_connections
add column if not exists scan_in_progress boolean not null default false;

alter table public.email_connections
add column if not exists scan_started_at timestamptz;

alter table public.email_connections
add column if not exists last_processed_uid bigint;

alter table public.email_connections
add column if not exists last_uid_validity bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_connections_scan_interval_minimum'
  ) then
    alter table public.email_connections
    add constraint email_connections_scan_interval_minimum
    check (scan_interval_minutes >= 60)
    not valid;
  end if;
end $$;

create unique index if not exists email_messages_connection_provider_message_unique
on public.email_messages (email_connection_id, provider_message_id)
where provider_message_id is not null;

create index if not exists idx_email_connections_imap_due_scan
on public.email_connections(provider, is_active, auto_scan_enabled, next_scan_at)
where provider in ('imap', 'custom_imap');
