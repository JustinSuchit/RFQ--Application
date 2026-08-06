alter table public.rfqs
add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.rfqs
add column if not exists review_status text not null default 'new';

alter table public.rfqs
add column if not exists priority text not null default 'normal';

alter table public.rfqs
add column if not exists next_action text;

alter table public.rfqs
add column if not exists review_due_at timestamptz;

alter table public.rfqs
add column if not exists last_activity_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rfqs_review_status_check'
  ) then
    alter table public.rfqs
    add constraint rfqs_review_status_check
    check (review_status in (
      'new',
      'needs_review',
      'missing_items',
      'awaiting_pricing',
      'awaiting_approval',
      'ready_to_send',
      'overdue',
      'completed'
    ))
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rfqs_priority_check'
  ) then
    alter table public.rfqs
    add constraint rfqs_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'))
    not valid;
  end if;
end $$;

create index if not exists idx_rfqs_org_review_status
on public.rfqs(organization_id, review_status);

create index if not exists idx_rfqs_org_assigned_to
on public.rfqs(organization_id, assigned_to);

create index if not exists idx_rfqs_org_review_due_at
on public.rfqs(organization_id, review_due_at);

create index if not exists idx_rfqs_org_last_activity_at
on public.rfqs(organization_id, last_activity_at);
