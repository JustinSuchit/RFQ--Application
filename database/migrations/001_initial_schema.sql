-- ============================================================
-- RFQ SaaS Initial Schema
-- Multi-tenant database structure for generalized RFQ software
-- ============================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- Each customer company using the SaaS platform is an organization.
-- Every company-owned record links back to organizations.id.
-- ============================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  industry text,
  country text,
  currency text not null default 'TTD',
  timezone text not null default 'America/Port_of_Spain',
  tax_rate numeric(10, 4) not null default 0,
  logo_url text,
  subscription_status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ============================================================
-- CUSTOMERS
-- Customers belong to one organization.
-- ============================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  tax_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SUPPLIERS
-- Suppliers belong to one organization.
-- ============================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_name text not null,
  contact_name text,
  email text,
  phone text,
  category text,
  currency text not null default 'TTD',
  payment_terms text,
  rating numeric(3, 2),
  average_response_days numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RFQS
-- Core request-for-quotation records.
-- ============================================================

create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  rfq_number text not null,
  subject text not null,
  source text,
  priority text not null default 'normal',
  status text not null default 'draft',
  submission_deadline date,
  delivery_location text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  estimated_value numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rfq_number)
);

create table if not exists public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit text,
  required_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SUPPLIER QUOTES
-- Supplier pricing connected to an RFQ.
-- ============================================================

create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  quote_reference text,
  currency text not null default 'TTD',
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  freight numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  lead_time_days integer,
  status text not null default 'received',
  valid_until date,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_quote_id uuid not null references public.supplier_quotes(id) on delete cascade,
  rfq_item_id uuid references public.rfq_items(id) on delete set null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_cost numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  availability text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CUSTOMER QUOTES
-- Quotes generated for the customer from an RFQ.
-- ============================================================

create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  quote_number text not null,
  revision integer not null default 1,
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  delivery_fee numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  margin_percentage numeric(8, 4),
  status text not null default 'draft',
  approval_status text not null default 'not_required',
  valid_until date,
  pdf_url text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create table if not exists public.customer_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_quote_id uuid not null references public.customer_quotes(id) on delete cascade,
  rfq_item_id uuid references public.rfq_items(id) on delete set null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total_price numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- APPROVAL WORKFLOWS
-- Configurable approval rules per organization.
-- ============================================================

create table if not exists public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  rule_type text not null,
  condition_field text not null,
  condition_operator text not null,
  condition_value text not null,
  approver_role text,
  approver_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_quote_id uuid references public.customer_quotes(id) on delete cascade,
  approval_rule_id uuid references public.approval_rules(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  approver_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  comments text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- ACTIVITY LOGS
-- Audit trail for important actions.
-- ============================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid references public.rfqs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- Improves query performance for organization-scoped data.
-- ============================================================

create index if not exists idx_organization_members_user_id
on public.organization_members(user_id);

create index if not exists idx_organization_members_org_id
on public.organization_members(organization_id);

create index if not exists idx_customers_organization_id
on public.customers(organization_id);

create index if not exists idx_suppliers_organization_id
on public.suppliers(organization_id);

create index if not exists idx_rfqs_organization_id
on public.rfqs(organization_id);

create index if not exists idx_rfqs_customer_id
on public.rfqs(customer_id);

create index if not exists idx_rfq_items_rfq_id
on public.rfq_items(rfq_id);

create index if not exists idx_supplier_quotes_rfq_id
on public.supplier_quotes(rfq_id);

create index if not exists idx_customer_quotes_rfq_id
on public.customer_quotes(rfq_id);

create index if not exists idx_activity_logs_organization_id
on public.activity_logs(organization_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- Automatically updates updated_at on modified records.
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

drop trigger if exists set_rfqs_updated_at on public.rfqs;
create trigger set_rfqs_updated_at
before update on public.rfqs
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_quotes_updated_at on public.supplier_quotes;
create trigger set_supplier_quotes_updated_at
before update on public.supplier_quotes
for each row execute function public.set_updated_at();

drop trigger if exists set_customer_quotes_updated_at on public.customer_quotes;
create trigger set_customer_quotes_updated_at
before update on public.customer_quotes
for each row execute function public.set_updated_at();

drop trigger if exists set_approval_rules_updated_at on public.approval_rules;
create trigger set_approval_rules_updated_at
before update on public.approval_rules
for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- RLS is required for multi-tenant data isolation.
-- ============================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_items enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.supplier_quote_items enable row level security;
alter table public.customer_quotes enable row level security;
alter table public.customer_quote_items enable row level security;
alter table public.approval_rules enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_logs enable row level security;

-- Helper function used by RLS policies.
-- Checks if the currently authenticated user is an active member of an organization.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

-- ============================================================
-- ORGANIZATION POLICIES
-- ============================================================

drop policy if exists "Members can read their organizations" on public.organizations;
create policy "Members can read their organizations"
on public.organizations
for select
using (public.is_org_member(id));

drop policy if exists "Authenticated users can create organizations" on public.organizations;
create policy "Authenticated users can create organizations"
on public.organizations
for insert
with check (auth.uid() is not null);

drop policy if exists "Members can update their organizations" on public.organizations;
create policy "Members can update their organizations"
on public.organizations
for update
using (public.is_org_member(id))
with check (public.is_org_member(id));

-- Users can see their own memberships.
drop policy if exists "Users can read their memberships" on public.organization_members;
create policy "Users can read their memberships"
on public.organization_members
for select
using (user_id = auth.uid());

-- Allows onboarding to add the creator as the first organization member.
drop policy if exists "Authenticated users can create memberships for themselves" on public.organization_members;
create policy "Authenticated users can create memberships for themselves"
on public.organization_members
for insert
with check (user_id = auth.uid());

drop policy if exists "Members can update organization memberships" on public.organization_members;
create policy "Members can update organization memberships"
on public.organization_members
for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- ============================================================
-- GENERIC ORGANIZATION-OWNED POLICIES
-- ============================================================

drop policy if exists "Org members can select customers" on public.customers;
create policy "Org members can select customers"
on public.customers for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert customers" on public.customers;
create policy "Org members can insert customers"
on public.customers for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update customers" on public.customers;
create policy "Org members can update customers"
on public.customers for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete customers" on public.customers;
create policy "Org members can delete customers"
on public.customers for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select suppliers" on public.suppliers;
create policy "Org members can select suppliers"
on public.suppliers for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert suppliers" on public.suppliers;
create policy "Org members can insert suppliers"
on public.suppliers for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update suppliers" on public.suppliers;
create policy "Org members can update suppliers"
on public.suppliers for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete suppliers" on public.suppliers;
create policy "Org members can delete suppliers"
on public.suppliers for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select rfqs" on public.rfqs;
create policy "Org members can select rfqs"
on public.rfqs for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert rfqs" on public.rfqs;
create policy "Org members can insert rfqs"
on public.rfqs for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update rfqs" on public.rfqs;
create policy "Org members can update rfqs"
on public.rfqs for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete rfqs" on public.rfqs;
create policy "Org members can delete rfqs"
on public.rfqs for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select rfq_items" on public.rfq_items;
create policy "Org members can select rfq_items"
on public.rfq_items for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert rfq_items" on public.rfq_items;
create policy "Org members can insert rfq_items"
on public.rfq_items for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update rfq_items" on public.rfq_items;
create policy "Org members can update rfq_items"
on public.rfq_items for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete rfq_items" on public.rfq_items;
create policy "Org members can delete rfq_items"
on public.rfq_items for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select supplier_quotes" on public.supplier_quotes;
create policy "Org members can select supplier_quotes"
on public.supplier_quotes for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert supplier_quotes" on public.supplier_quotes;
create policy "Org members can insert supplier_quotes"
on public.supplier_quotes for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update supplier_quotes" on public.supplier_quotes;
create policy "Org members can update supplier_quotes"
on public.supplier_quotes for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete supplier_quotes" on public.supplier_quotes;
create policy "Org members can delete supplier_quotes"
on public.supplier_quotes for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select supplier_quote_items" on public.supplier_quote_items;
create policy "Org members can select supplier_quote_items"
on public.supplier_quote_items for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert supplier_quote_items" on public.supplier_quote_items;
create policy "Org members can insert supplier_quote_items"
on public.supplier_quote_items for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update supplier_quote_items" on public.supplier_quote_items;
create policy "Org members can update supplier_quote_items"
on public.supplier_quote_items for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete supplier_quote_items" on public.supplier_quote_items;
create policy "Org members can delete supplier_quote_items"
on public.supplier_quote_items for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select customer_quotes" on public.customer_quotes;
create policy "Org members can select customer_quotes"
on public.customer_quotes for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert customer_quotes" on public.customer_quotes;
create policy "Org members can insert customer_quotes"
on public.customer_quotes for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update customer_quotes" on public.customer_quotes;
create policy "Org members can update customer_quotes"
on public.customer_quotes for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete customer_quotes" on public.customer_quotes;
create policy "Org members can delete customer_quotes"
on public.customer_quotes for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select customer_quote_items" on public.customer_quote_items;
create policy "Org members can select customer_quote_items"
on public.customer_quote_items for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert customer_quote_items" on public.customer_quote_items;
create policy "Org members can insert customer_quote_items"
on public.customer_quote_items for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update customer_quote_items" on public.customer_quote_items;
create policy "Org members can update customer_quote_items"
on public.customer_quote_items for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete customer_quote_items" on public.customer_quote_items;
create policy "Org members can delete customer_quote_items"
on public.customer_quote_items for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select approval_rules" on public.approval_rules;
create policy "Org members can select approval_rules"
on public.approval_rules for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert approval_rules" on public.approval_rules;
create policy "Org members can insert approval_rules"
on public.approval_rules for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update approval_rules" on public.approval_rules;
create policy "Org members can update approval_rules"
on public.approval_rules for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete approval_rules" on public.approval_rules;
create policy "Org members can delete approval_rules"
on public.approval_rules for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select approval_requests" on public.approval_requests;
create policy "Org members can select approval_requests"
on public.approval_requests for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert approval_requests" on public.approval_requests;
create policy "Org members can insert approval_requests"
on public.approval_requests for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update approval_requests" on public.approval_requests;
create policy "Org members can update approval_requests"
on public.approval_requests for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete approval_requests" on public.approval_requests;
create policy "Org members can delete approval_requests"
on public.approval_requests for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select activity_logs" on public.activity_logs;
create policy "Org members can select activity_logs"
on public.activity_logs for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert activity_logs" on public.activity_logs;
create policy "Org members can insert activity_logs"
on public.activity_logs for insert
with check (public.is_org_member(organization_id));
