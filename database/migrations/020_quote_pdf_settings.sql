alter table public.organization_settings
add column if not exists quote_pdf_company_name text,
add column if not exists quote_pdf_address text,
add column if not exists quote_pdf_phone text,
add column if not exists quote_pdf_email text,
add column if not exists quote_pdf_website text,
add column if not exists quote_pdf_logo_path text,
add column if not exists quote_pdf_accent_color text,
add column if not exists quote_pdf_footer_text text,
add column if not exists quote_pdf_terms text,
add column if not exists quote_pdf_show_taxable_subtotal boolean not null default true,
add column if not exists quote_pdf_show_discount boolean not null default true,
add column if not exists quote_pdf_show_delivery boolean not null default true,
add column if not exists quote_pdf_show_item_numbers boolean not null default true,
add column if not exists quote_pdf_show_quote_status boolean not null default true,
add column if not exists quote_pdf_show_approval_status boolean not null default true,
add column if not exists quote_pdf_show_notes boolean not null default false,
add column if not exists quote_pdf_default_validity_days integer not null default 30,
add column if not exists quote_pdf_currency_position text not null default 'prefix',
add column if not exists quote_pdf_page_size text not null default 'A4',
add column if not exists quote_pdf_template text not null default 'professional';

alter table public.customer_quotes
add column if not exists pdf_settings_snapshot jsonb,
add column if not exists pdf_footer_note text,
add column if not exists pdf_terms text,
add column if not exists pdf_show_notes boolean,
add column if not exists pdf_template text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_settings_quote_pdf_currency_position_check'
  ) then
    alter table public.organization_settings
    add constraint organization_settings_quote_pdf_currency_position_check
    check (quote_pdf_currency_position in ('prefix', 'suffix'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organization_settings_quote_pdf_page_size_check'
  ) then
    alter table public.organization_settings
    add constraint organization_settings_quote_pdf_page_size_check
    check (quote_pdf_page_size in ('A4', 'Letter'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organization_settings_quote_pdf_template_check'
  ) then
    alter table public.organization_settings
    add constraint organization_settings_quote_pdf_template_check
    check (quote_pdf_template in ('professional', 'compact'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('quote-pdf-assets', 'quote-pdf-assets', false)
on conflict (id) do nothing;

drop policy if exists "Org members can read quote PDF assets" on storage.objects;
create policy "Org members can read quote PDF assets"
on storage.objects for select
using (
  bucket_id = 'quote-pdf-assets'
  and public.is_org_member((storage.foldername(name))[2]::uuid)
);

drop policy if exists "Org members can upload quote PDF assets" on storage.objects;
create policy "Org members can upload quote PDF assets"
on storage.objects for insert
with check (
  bucket_id = 'quote-pdf-assets'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member((storage.foldername(name))[2]::uuid)
);

drop policy if exists "Org members can update quote PDF assets" on storage.objects;
create policy "Org members can update quote PDF assets"
on storage.objects for update
using (
  bucket_id = 'quote-pdf-assets'
  and public.is_org_member((storage.foldername(name))[2]::uuid)
)
with check (
  bucket_id = 'quote-pdf-assets'
  and public.is_org_member((storage.foldername(name))[2]::uuid)
);
