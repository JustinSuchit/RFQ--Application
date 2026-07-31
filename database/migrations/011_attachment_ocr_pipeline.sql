create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_message_id uuid not null references public.email_messages(id) on delete cascade,
  provider_attachment_id text,
  file_name text,
  content_type text,
  size_bytes integer,
  storage_path text,
  ocr_status text default 'pending',
  extracted_text text,
  extraction_method text,
  extraction_error text,
  extracted_at timestamptz,
  raw_extraction jsonb,
  created_at timestamptz not null default now()
);

alter table public.email_attachments
add column if not exists file_name text;

alter table public.email_attachments
add column if not exists content_type text;

alter table public.email_attachments
add column if not exists size_bytes integer;

alter table public.email_attachments
add column if not exists storage_path text;

alter table public.email_attachments
add column if not exists ocr_status text default 'pending';

alter table public.email_attachments
add column if not exists extracted_text text;

alter table public.email_attachments
add column if not exists extraction_method text;

alter table public.email_attachments
add column if not exists extraction_error text;

alter table public.email_attachments
add column if not exists extracted_at timestamptz;

alter table public.email_attachments
add column if not exists raw_extraction jsonb;

alter table public.email_attachments
add column if not exists provider_attachment_id text;

alter table public.email_attachments
add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.email_attachments
add column if not exists email_message_id uuid references public.email_messages(id) on delete cascade;

alter table public.email_attachments
add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_attachments_ocr_status_check'
  ) then
    alter table public.email_attachments
    add constraint email_attachments_ocr_status_check
    check (ocr_status in ('pending', 'processing', 'completed', 'failed', 'skipped'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'email_attachments_extraction_method_check'
  ) then
    alter table public.email_attachments
    add constraint email_attachments_extraction_method_check
    check (
      extraction_method is null
      or extraction_method in ('pdf_text', 'image_ocr', 'scanned_pdf_ocr', 'manual', 'future_ai')
    );
  end if;
end $$;

create unique index if not exists email_attachments_provider_attachment_unique
on public.email_attachments (organization_id, email_message_id, provider_attachment_id);

create index if not exists idx_email_attachments_email_message_id
on public.email_attachments(email_message_id);

alter table public.email_attachments enable row level security;

drop policy if exists "Org members can select email_attachments" on public.email_attachments;
create policy "Org members can select email_attachments"
on public.email_attachments for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_attachments" on public.email_attachments;
create policy "Org members can insert email_attachments"
on public.email_attachments for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_attachments" on public.email_attachments;
create policy "Org members can update email_attachments"
on public.email_attachments for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete email_attachments" on public.email_attachments;
create policy "Org members can delete email_attachments"
on public.email_attachments for delete
using (public.is_org_member(organization_id));

create table if not exists public.attachment_extracted_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_message_id uuid references public.email_messages(id) on delete cascade,
  email_attachment_id uuid references public.email_attachments(id) on delete cascade,
  description text not null,
  quantity numeric,
  unit text,
  notes text,
  confidence numeric,
  status text not null default 'pending',
  rfq_item_id uuid references public.rfq_items(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attachment_extracted_items_status_check'
  ) then
    alter table public.attachment_extracted_items
    add constraint attachment_extracted_items_status_check
    check (status in ('pending', 'accepted', 'rejected', 'imported'));
  end if;
end $$;

create index if not exists idx_attachment_extracted_items_email_message_id
on public.attachment_extracted_items(email_message_id);

create index if not exists idx_attachment_extracted_items_email_attachment_id
on public.attachment_extracted_items(email_attachment_id);

alter table public.attachment_extracted_items enable row level security;

drop policy if exists "Org members can select attachment_extracted_items" on public.attachment_extracted_items;
create policy "Org members can select attachment_extracted_items"
on public.attachment_extracted_items for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert attachment_extracted_items" on public.attachment_extracted_items;
create policy "Org members can insert attachment_extracted_items"
on public.attachment_extracted_items for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update attachment_extracted_items" on public.attachment_extracted_items;
create policy "Org members can update attachment_extracted_items"
on public.attachment_extracted_items for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete attachment_extracted_items" on public.attachment_extracted_items;
create policy "Org members can delete attachment_extracted_items"
on public.attachment_extracted_items for delete
using (public.is_org_member(organization_id));
