-- ============================================================
-- In-app notifications
-- Per-user notification state derived from actionable workflow events.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  href text not null,
  priority text not null default 'info',
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, dedupe_key)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_type_check'
  ) then
    alter table public.notifications
    add constraint notifications_type_check
    check (
      type in (
        'approval',
        'supplier_response',
        'rfq_deadline',
        'rfq_overdue',
        'quote',
        'rfq_status',
        'email_intake',
        'extraction',
        'system'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'notifications_priority_check'
  ) then
    alter table public.notifications
    add constraint notifications_priority_check
    check (priority in ('info', 'success', 'warning', 'critical'));
  end if;
end $$;

create index if not exists idx_notifications_user_org_created
on public.notifications(user_id, organization_id, created_at desc);

create index if not exists idx_notifications_user_org_unread
on public.notifications(user_id, organization_id, read_at)
where read_at is null;

create index if not exists idx_notifications_org_user_dedupe
on public.notifications(organization_id, user_id, dedupe_key);

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

drop policy if exists "Users can select own notifications" on public.notifications;
create policy "Users can select own notifications"
on public.notifications for select
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
on public.notifications for insert
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications for delete
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);
