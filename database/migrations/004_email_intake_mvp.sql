-- ============================================================
-- Azure-free Email Intake MVP
-- Manually logged emails that can be classified and converted to RFQs
-- ============================================================

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'manual',
  provider_message_id text not null,
  from_name text,
  from_email text not null,
  subject text not null,
  body_preview text,
  body text,
  received_at timestamptz not null default now(),
  has_attachments boolean not null default false,
  classification text not null default 'needs_review',
  is_rfq boolean,
  rfq_id uuid references public.rfqs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_message_id)
);

create index if not exists idx_email_messages_organization_id
on public.email_messages(organization_id);

create index if not exists idx_email_messages_rfq_id
on public.email_messages(rfq_id);

drop trigger if exists set_email_messages_updated_at on public.email_messages;
create trigger set_email_messages_updated_at
before update on public.email_messages
for each row execute function public.set_updated_at();

alter table public.email_messages enable row level security;

drop policy if exists "Org members can select email_messages" on public.email_messages;
create policy "Org members can select email_messages"
on public.email_messages for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_messages" on public.email_messages;
create policy "Org members can insert email_messages"
on public.email_messages for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_messages" on public.email_messages;
create policy "Org members can update email_messages"
on public.email_messages for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete email_messages" on public.email_messages;
create policy "Org members can delete email_messages"
on public.email_messages for delete
using (public.is_org_member(organization_id));
