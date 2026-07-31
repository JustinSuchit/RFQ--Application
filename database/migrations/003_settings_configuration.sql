-- ============================================================
-- Settings Configuration
-- Generalized multi-tenant configuration for RFQ SaaS
-- ============================================================

alter table public.organizations
add column if not exists brand_color text,
add column if not exists quote_header_text text,
add column if not exists quote_footer_text text;

create table if not exists public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_prefix text not null default 'RFQ',
  quote_prefix text not null default 'QT',
  rfq_number_padding integer not null default 6,
  quote_number_padding integer not null default 6,
  rfq_number_reset text not null default 'yearly',
  quote_number_reset text not null default 'yearly',
  default_quote_validity_days integer not null default 30,
  default_markup_percentage numeric(8,4) not null default 25,
  default_terms_and_conditions text,
  default_quote_notes text,
  email_from_name text,
  email_reply_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_type text not null,
  name text not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

drop trigger if exists set_organization_settings_updated_at on public.organization_settings;
create trigger set_organization_settings_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_integration_settings_updated_at on public.integration_settings;
create trigger set_integration_settings_updated_at
before update on public.integration_settings
for each row execute function public.set_updated_at();

alter table public.organization_settings enable row level security;
alter table public.email_templates enable row level security;
alter table public.integration_settings enable row level security;

drop policy if exists "Org members can select organization_settings" on public.organization_settings;
create policy "Org members can select organization_settings"
on public.organization_settings for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert organization_settings" on public.organization_settings;
create policy "Org members can insert organization_settings"
on public.organization_settings for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update organization_settings" on public.organization_settings;
create policy "Org members can update organization_settings"
on public.organization_settings for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete organization_settings" on public.organization_settings;
create policy "Org members can delete organization_settings"
on public.organization_settings for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select email_templates" on public.email_templates;
create policy "Org members can select email_templates"
on public.email_templates for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_templates" on public.email_templates;
create policy "Org members can insert email_templates"
on public.email_templates for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_templates" on public.email_templates;
create policy "Org members can update email_templates"
on public.email_templates for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete email_templates" on public.email_templates;
create policy "Org members can delete email_templates"
on public.email_templates for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select integration_settings" on public.integration_settings;
create policy "Org members can select integration_settings"
on public.integration_settings for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert integration_settings" on public.integration_settings;
create policy "Org members can insert integration_settings"
on public.integration_settings for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update integration_settings" on public.integration_settings;
create policy "Org members can update integration_settings"
on public.integration_settings for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete integration_settings" on public.integration_settings;
create policy "Org members can delete integration_settings"
on public.integration_settings for delete
using (public.is_org_member(organization_id));
