-- P0 OCR reliability RPC support and atomic extracted-item replacement.

alter table public.email_attachments
add column if not exists ocr_attempts integer not null default 0;

alter table public.email_attachments
add column if not exists ocr_started_at timestamptz;

alter table public.email_attachments
add column if not exists ocr_run_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_attachments_ocr_attempts_check'
  ) then
    alter table public.email_attachments
    add constraint email_attachments_ocr_attempts_check
    check (ocr_attempts >= 0)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'email_attachments_completed_has_result_check'
  ) then
    alter table public.email_attachments
    add constraint email_attachments_completed_has_result_check
    check (
      ocr_status <> 'completed'
      or (extracted_text is not null and extracted_at is not null)
    )
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'email_attachments_failed_has_error_check'
  ) then
    alter table public.email_attachments
    add constraint email_attachments_failed_has_error_check
    check (
      ocr_status <> 'failed'
      or extraction_error is not null
    )
    not valid;
  end if;
end $$;

create or replace function public.begin_attachment_extraction(p_attachment_id uuid)
returns table (
  ok boolean,
  claimed boolean,
  ocr_run_id uuid,
  ocr_attempts integer,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment public.email_attachments%rowtype;
  v_run_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    return query select false, false, null::uuid, null::integer, 'Not authenticated'::text;
    return;
  end if;

  select *
  into v_attachment
  from public.email_attachments
  where id = p_attachment_id
  for update;

  if not found then
    return query select false, false, null::uuid, null::integer, 'Attachment not found'::text;
    return;
  end if;

  if not public.can_manage_procurement(v_attachment.organization_id) then
    return query select false, false, v_attachment.ocr_run_id, v_attachment.ocr_attempts, 'Not authorized'::text;
    return;
  end if;

  if v_attachment.ocr_status in ('completed', 'skipped') then
    return query select true, false, v_attachment.ocr_run_id, v_attachment.ocr_attempts, null::text;
    return;
  end if;

  if v_attachment.ocr_status = 'processing'
    and v_attachment.ocr_started_at is not null
    and v_attachment.ocr_started_at > now() - interval '30 minutes'
  then
    return query select true, false, v_attachment.ocr_run_id, v_attachment.ocr_attempts, null::text;
    return;
  end if;

  update public.email_attachments as ea
  set
    ocr_status = 'processing',
    ocr_attempts = ea.ocr_attempts + 1,
    ocr_started_at = now(),
    ocr_run_id = v_run_id,
    extraction_error = null
  where ea.id = p_attachment_id
  returning ea.ocr_run_id, ea.ocr_attempts
  into v_attachment.ocr_run_id, v_attachment.ocr_attempts;

  return query select true, true, v_attachment.ocr_run_id, v_attachment.ocr_attempts, null::text;
exception
  when others then
    return query select false, false, null::uuid, null::integer, sqlerrm::text;
end;
$$;

create or replace function public.accept_extracted_item(p_extracted_item_id uuid, p_rfq_id uuid)
returns table (
  ok boolean,
  rfq_item_id uuid,
  created boolean,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.attachment_extracted_items%rowtype;
  v_rfq public.rfqs%rowtype;
  v_new_rfq_item_id uuid;
  v_existing_rfq_item public.rfq_items%rowtype;
begin
  if auth.uid() is null then
    return query select false, null::uuid, false, 'Not authenticated'::text;
    return;
  end if;

  select *
  into v_item
  from public.attachment_extracted_items
  where id = p_extracted_item_id
  for update;

  if not found then
    return query select false, null::uuid, false, 'Extracted item not found'::text;
    return;
  end if;

  if not public.can_manage_procurement(v_item.organization_id) then
    return query select false, v_item.rfq_item_id, false, 'Not authorized'::text;
    return;
  end if;

  select *
  into v_rfq
  from public.rfqs
  where id = p_rfq_id
  for update;

  if not found or v_rfq.organization_id <> v_item.organization_id then
    return query select false, null::uuid, false, 'RFQ not found for extracted item tenant'::text;
    return;
  end if;

  if v_item.rfq_item_id is not null then
    select *
    into v_existing_rfq_item
    from public.rfq_items
    where id = v_item.rfq_item_id
      and organization_id = v_item.organization_id;

    if not found then
      return query select false, v_item.rfq_item_id, false, 'Imported RFQ item was not found'::text;
      return;
    end if;

    if v_existing_rfq_item.rfq_id <> p_rfq_id then
      return query select false, v_item.rfq_item_id, false, 'Extracted item is already imported into a different RFQ'::text;
      return;
    end if;

    update public.attachment_extracted_items
    set status = 'imported'
    where id = p_extracted_item_id
      and status <> 'imported';

    return query select true, v_item.rfq_item_id, false, null::text;
    return;
  end if;

  insert into public.rfq_items (
    organization_id,
    rfq_id,
    description,
    quantity,
    unit,
    notes
  )
  values (
    v_item.organization_id,
    p_rfq_id,
    v_item.description,
    coalesce(v_item.quantity, 1),
    v_item.unit,
    v_item.notes
  )
  returning id into v_new_rfq_item_id;

  update public.attachment_extracted_items
  set
    status = 'imported',
    rfq_item_id = v_new_rfq_item_id
  where id = p_extracted_item_id;

  insert into public.activity_logs (organization_id, rfq_id, user_id, action, details)
  values (
    v_item.organization_id,
    p_rfq_id,
    auth.uid(),
    'extracted_item_imported',
    jsonb_build_object(
      'attachment_extracted_item_id', p_extracted_item_id,
      'rfq_item_id', v_new_rfq_item_id,
      'email_attachment_id', v_item.email_attachment_id
    )
  );

  return query select true, v_new_rfq_item_id, true, null::text;
exception
  when others then
    return query select false, null::uuid, false, sqlerrm::text;
end;
$$;

create or replace function public.replace_attachment_extracted_items(
  p_email_attachment_id uuid,
  p_ocr_run_id uuid,
  p_items jsonb
)
returns table (
  ok boolean,
  inserted_count integer,
  preserved_count integer,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment public.email_attachments%rowtype;
  v_item jsonb;
  v_description text;
  v_quantity numeric;
  v_unit text;
  v_notes text;
  v_confidence numeric;
  v_key text;
  v_seen_keys text[] := array[]::text[];
  v_inserted_count integer := 0;
  v_preserved_count integer := 0;
begin
  if auth.uid() is null then
    return query select false, 0, 0, 'Not authenticated'::text;
    return;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return query select false, 0, 0, 'Items must be a JSON array'::text;
    return;
  end if;

  select *
  into v_attachment
  from public.email_attachments
  where id = p_email_attachment_id
  for update;

  if not found then
    return query select false, 0, 0, 'Attachment not found'::text;
    return;
  end if;

  if not public.can_manage_procurement(v_attachment.organization_id) then
    return query select false, 0, 0, 'Not authorized'::text;
    return;
  end if;

  if v_attachment.ocr_status <> 'processing' then
    return query select false, 0, 0, 'Attachment is not processing'::text;
    return;
  end if;

  if v_attachment.ocr_run_id is distinct from p_ocr_run_id then
    return query select false, 0, 0, 'OCR run does not match attachment'::text;
    return;
  end if;

  select count(*)
  into v_preserved_count
  from public.attachment_extracted_items
  where email_attachment_id = p_email_attachment_id
    and status in ('accepted', 'imported');

  delete from public.attachment_extracted_items
  where email_attachment_id = p_email_attachment_id
    and status in ('pending', 'rejected');

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_description := nullif(btrim(v_item->>'description'), '');
    v_quantity := nullif(v_item->>'quantity', '')::numeric;
    v_unit := nullif(btrim(v_item->>'unit'), '');
    v_notes := nullif(btrim(v_item->>'notes'), '');
    v_confidence := nullif(v_item->>'confidence', '')::numeric;

    if v_description is null then
      continue;
    end if;

    v_key :=
      lower(v_description)
      || '|'
      || coalesce(v_quantity, 0)::text
      || '|'
      || lower(coalesce(v_unit, ''));

    if v_key = any(v_seen_keys) then
      continue;
    end if;

    if exists (
      select 1
      from public.attachment_extracted_items existing
      where existing.email_attachment_id = p_email_attachment_id
        and existing.status in ('accepted', 'imported')
        and lower(btrim(existing.description)) = lower(v_description)
        and coalesce(existing.quantity, 0)::text = coalesce(v_quantity, 0)::text
        and lower(coalesce(btrim(existing.unit), '')) = lower(coalesce(v_unit, ''))
    ) then
      v_seen_keys := array_append(v_seen_keys, v_key);
      continue;
    end if;

    insert into public.attachment_extracted_items (
      organization_id,
      email_message_id,
      email_attachment_id,
      description,
      quantity,
      unit,
      notes,
      confidence,
      status
    )
    values (
      v_attachment.organization_id,
      v_attachment.email_message_id,
      p_email_attachment_id,
      v_description,
      v_quantity,
      v_unit,
      v_notes,
      v_confidence,
      'pending'
    );

    v_seen_keys := array_append(v_seen_keys, v_key);
    v_inserted_count := v_inserted_count + 1;
  end loop;

  return query select true, v_inserted_count, v_preserved_count, null::text;
exception
  when others then
    return query select false, 0, 0, sqlerrm::text;
end;
$$;

revoke all on function public.begin_attachment_extraction(uuid) from public;
revoke all on function public.begin_attachment_extraction(uuid) from anon;
grant execute on function public.begin_attachment_extraction(uuid) to authenticated;

revoke all on function public.accept_extracted_item(uuid, uuid) from public;
revoke all on function public.accept_extracted_item(uuid, uuid) from anon;
grant execute on function public.accept_extracted_item(uuid, uuid) to authenticated;

revoke all on function public.replace_attachment_extracted_items(uuid, uuid, jsonb) from public;
revoke all on function public.replace_attachment_extracted_items(uuid, uuid, jsonb) from anon;
grant execute on function public.replace_attachment_extracted_items(uuid, uuid, jsonb) to authenticated;
