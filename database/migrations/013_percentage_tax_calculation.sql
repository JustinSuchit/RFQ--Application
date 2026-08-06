-- ============================================================
-- Percentage Tax Calculation
-- Store tax rates as whole percentage values and preserve tax
-- amounts separately for customer quotes.
-- ============================================================

alter table public.organizations
add column if not exists tax_rate numeric(10, 4) not null default 0;

alter table public.customer_quotes
add column if not exists tax_rate numeric(10, 4) not null default 0,
add column if not exists tax_amount numeric(14, 2) not null default 0;

-- Existing org tax rates were historically entered as decimals such as 0.15.
-- Convert only clearly fractional values; do not touch 12.5 or 15.
update public.organizations
set tax_rate = tax_rate * 100
where tax_rate > 0 and tax_rate <= 1;

-- Preserve historical fixed tax amounts in the new explicit amount column.
update public.customer_quotes
set tax_amount = coalesce(nullif(tax_amount, 0), tax, 0)
where tax_amount = 0 and coalesce(tax, 0) <> 0;

-- If any existing quote rates were already present as fractions, normalize them.
update public.customer_quotes
set tax_rate = tax_rate * 100
where tax_rate > 0 and tax_rate <= 1;
