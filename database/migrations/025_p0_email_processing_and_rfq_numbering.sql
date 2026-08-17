-- P0 email processing state and atomic email-to-RFQ numbering.

alter table public.email_messages
add column if not exists processing_status text not null default 'pending';

alter table public.email_messages
add column if not exists processing_attempts integer not null default 0;

alter table public.email_messages
add column if not exists last_processing_error text;

alter table public.email_messages
add column if not exists processing_started_at timestamptz;

alter table public.email_messages
add column if not exists processed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_messages_processing_status_check'
  ) then
    alter table public.email_messages
    add constraint email_messages_processing_status_check
    check (processing_status in ('pending', 'processing', 'processed', 'failed', 'skipped'))
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'email_messages_processing_attempts_check'
  ) then
    alter table public.email_messages
    add constraint email_messages_processing_attempts_check
    check (processing_attempts >= 0)
    not valid;
  end if;
end $$;

create table if not exists public.rfq_number_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, year)
);

alter table public.rfq_number_counters enable row level security;

revoke all on public.rfq_number_counters from public;
revoke all on public.rfq_number_counters from anon;
revoke all on public.rfq_number_counters from authenticated;

drop trigger if exists set_rfq_number_counters_updated_at on public.rfq_number_counters;
create trigger set_rfq_number_counters_updated_at
before update on public.rfq_number_counters
for each row execute function public.set_updated_at();

with parsed_numbers as (
  select
    organization_id,
    (matches)[1]::integer as rfq_year,
    (matches)[2]::integer as rfq_sequence
  from (
    select
      organization_id,
      regexp_match(rfq_number, '^RFQ-(\d{4})-(\d+)$') as matches
    from public.rfqs
    where rfq_number ~ '^RFQ-\d{4}-\d+$'
  ) parsed
)
insert into public.rfq_number_counters (organization_id, year, last_number)
select organization_id, rfq_year, max(rfq_sequence)
from parsed_numbers
group by organization_id, rfq_year
on conflict (organization_id, year)
do update set
  last_number = greatest(public.rfq_number_counters.last_number, excluded.last_number),
  updated_at = now();

create or replace function public.create_rfq_from_email(p_email_message_id uuid)
returns table (
  ok boolean,
  rfq_id uuid,
  rfq_number text,
  created boolean,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email public.email_messages%rowtype;
  v_existing_rfq_number text;
  v_year integer := extract(year from now())::integer;
  v_next_number integer;
  v_new_rfq_number text;
  v_new_rfq_id uuid;
begin
  if auth.uid() is null then
    return query select false, null::uuid, null::text, false, 'Not authenticated'::text;
    return;
  end if;

  select *
  into v_email
  from public.email_messages
  where id = p_email_message_id
  for update;

  if not found then
    return query select false, null::uuid, null::text, false, 'Email message not found'::text;
    return;
  end if;

  if not public.can_manage_procurement(v_email.organization_id) then
    return query select false, null::uuid, null::text, false, 'Not authorized'::text;
    return;
  end if;

  if v_email.rfq_id is not null then
    select r.rfq_number
    into v_existing_rfq_number
    from public.rfqs r
    where r.id = v_email.rfq_id
      and r.organization_id = v_email.organization_id;

    if not found then
      return query select false, v_email.rfq_id, null::text, false, 'Linked RFQ was not found for this organization'::text;
      return;
    end if;

    update public.email_messages
    set
      processing_status = 'processed',
      processed_at = coalesce(processed_at, now()),
      last_processing_error = null
    where id = p_email_message_id;

    return query select true, v_email.rfq_id, v_existing_rfq_number, false, null::text;
    return;
  end if;

  update public.email_messages
  set
    processing_status = 'processing',
    processing_attempts = processing_attempts + 1,
    processing_started_at = now(),
    last_processing_error = null
  where id = p_email_message_id;

  begin
    insert into public.rfq_number_counters (organization_id, year, last_number)
    values (v_email.organization_id, v_year, 1)
    on conflict (organization_id, year)
    do update set
      last_number = public.rfq_number_counters.last_number + 1,
      updated_at = now()
    returning last_number into v_next_number;

    v_new_rfq_number := 'RFQ-' || v_year::text || '-' || lpad(v_next_number::text, 6, '0');

    insert into public.rfqs (
      organization_id,
      rfq_number,
      subject,
      source,
      priority,
      status,
      review_status,
      next_action,
      created_by,
      last_activity_at
    )
    values (
      v_email.organization_id,
      v_new_rfq_number,
      coalesce(nullif(v_email.subject, ''), 'Email RFQ'),
      'email',
      'normal',
      'draft',
      'needs_review',
      'Review extracted email and attachments',
      auth.uid(),
      now()
    )
    returning id into v_new_rfq_id;

    update public.email_messages
    set
      rfq_id = v_new_rfq_id,
      processing_status = 'processed',
      processed_at = now(),
      last_processing_error = null
    where id = p_email_message_id;

    insert into public.activity_logs (organization_id, rfq_id, user_id, action, details)
    values (
      v_email.organization_id,
      v_new_rfq_id,
      auth.uid(),
      'rfq_created_from_email',
      jsonb_build_object('email_message_id', p_email_message_id, 'rfq_number', v_new_rfq_number)
    );

    return query select true, v_new_rfq_id, v_new_rfq_number, true, null::text;
  exception
    when others then
      update public.email_messages
      set
        processing_status = 'failed',
        last_processing_error = sqlerrm,
        processing_started_at = null
      where id = p_email_message_id;

      return query select false, null::uuid, null::text, false, sqlerrm::text;
  end;
exception
  when others then
    update public.email_messages
    set
      processing_status = 'failed',
      last_processing_error = sqlerrm,
      processing_started_at = null
    where id = p_email_message_id;

    return query select false, null::uuid, null::text, false, sqlerrm::text;
end;
$$;

revoke all on function public.create_rfq_from_email(uuid) from public;
revoke all on function public.create_rfq_from_email(uuid) from anon;
grant execute on function public.create_rfq_from_email(uuid) to authenticated;
