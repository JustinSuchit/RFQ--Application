-- P0 RFQ lifecycle and approval security guards.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rfqs'::regclass
      and conname = 'rfqs_status_check'
  ) then
    alter table public.rfqs drop constraint rfqs_status_check;
  end if;

  alter table public.rfqs
  add constraint rfqs_status_check
  check (status in ('draft', 'awaiting_approval', 'accepted', 'declined', 'closed', 'cancelled'))
  not valid;
end $$;

create or replace function public.guard_rfq_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status not in ('awaiting_approval', 'accepted', 'declined', 'cancelled') then
      raise exception 'Invalid RFQ status transition from % to %', old.status, new.status;
    elsif old.status = 'awaiting_approval' and new.status not in ('accepted', 'declined', 'cancelled') then
      raise exception 'Invalid RFQ status transition from % to %', old.status, new.status;
    elsif old.status = 'accepted' and new.status not in ('closed', 'cancelled') then
      raise exception 'Invalid RFQ status transition from % to %', old.status, new.status;
    elsif old.status in ('closed', 'declined', 'cancelled') and new.status <> old.status then
      raise exception 'Invalid RFQ status transition from % to %', old.status, new.status;
    elsif old.status not in ('draft', 'awaiting_approval', 'accepted', 'closed', 'declined', 'cancelled') then
      raise exception 'Invalid current RFQ status %', old.status;
    end if;
  end if;

  if new.review_status is distinct from old.review_status then
    if old.review_status = 'new' and new.review_status not in ('needs_review', 'missing_items', 'awaiting_pricing', 'ready_to_send') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'needs_review' and new.review_status not in ('missing_items', 'awaiting_pricing', 'ready_to_send') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'missing_items' and new.review_status not in ('needs_review', 'awaiting_pricing') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'awaiting_pricing' and new.review_status not in ('missing_items', 'ready_to_send') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'ready_to_send' and new.review_status not in ('awaiting_approval', 'completed') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'awaiting_approval' and new.review_status not in ('ready_to_send', 'completed') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'overdue' and new.review_status not in ('needs_review', 'missing_items', 'awaiting_pricing', 'ready_to_send', 'awaiting_approval', 'completed') then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status = 'completed' and new.review_status <> 'completed' then
      raise exception 'Invalid RFQ review transition from % to %', old.review_status, new.review_status;
    elsif old.review_status not in ('new', 'needs_review', 'missing_items', 'awaiting_pricing', 'ready_to_send', 'awaiting_approval', 'overdue', 'completed') then
      raise exception 'Invalid current RFQ review status %', old.review_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_rfq_lifecycle_trigger on public.rfqs;
create trigger guard_rfq_lifecycle_trigger
before update of status, review_status on public.rfqs
for each row execute function public.guard_rfq_lifecycle();

create or replace function public.guard_customer_quote_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
  )
  and current_setting('app.approval_request_rpc_authorized', true) is distinct from 'on'
  and not public.can_approve(new.organization_id) then
    raise exception 'Not authorized to modify customer quote approval fields';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_customer_quote_approval_fields_trigger on public.customer_quotes;
create trigger guard_customer_quote_approval_fields_trigger
before update on public.customer_quotes
for each row execute function public.guard_customer_quote_approval_fields();

create or replace function public.resolve_approval_request(
  request_id uuid,
  decision text,
  decision_comments text default null
)
returns table (
  ok boolean,
  approval_request_id uuid,
  customer_quote_id uuid,
  resolved_decision text,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_quote public.customer_quotes%rowtype;
  v_rule public.approval_rules%rowtype;
  v_is_allowed boolean := false;
  v_rule_found boolean := false;
begin
  if auth.uid() is null then
    return query select false, null::uuid, null::uuid, null::text, 'Not authenticated'::text;
    return;
  end if;

  if decision not in ('approved', 'rejected') then
    return query select false, request_id, null::uuid, null::text, 'Decision must be approved or rejected'::text;
    return;
  end if;

  select *
  into v_request
  from public.approval_requests
  where id = request_id
  for update;

  if not found then
    return query select false, request_id, null::uuid, null::text, 'Approval request not found'::text;
    return;
  end if;

  if not public.is_org_member(v_request.organization_id) then
    return query select false, request_id, v_request.customer_quote_id, null::text, 'Not authorized'::text;
    return;
  end if;

  if v_request.status <> 'pending' then
    return query select true, v_request.id, v_request.customer_quote_id, v_request.status, null::text;
    return;
  end if;

  select *
  into v_quote
  from public.customer_quotes
  where id = v_request.customer_quote_id
  for update;

  if not found or v_quote.organization_id <> v_request.organization_id then
    return query select false, v_request.id, v_request.customer_quote_id, null::text, 'Customer quote not found for approval request tenant'::text;
    return;
  end if;

  if v_request.approval_rule_id is not null then
    select *
    into v_rule
    from public.approval_rules
    where id = v_request.approval_rule_id
      and organization_id = v_request.organization_id
      and is_active = true;

    v_rule_found := found;

    if not v_rule_found then
      return query select false, v_request.id, v_request.customer_quote_id, null::text, 'Active approval rule not found for request organization'::text;
      return;
    end if;
  end if;

  if v_request.approver_user_id is not null then
    v_is_allowed :=
      v_request.approver_user_id = auth.uid()
      or public.can_manage_organization(v_request.organization_id);
  elsif v_rule_found and v_rule.approver_user_id is not null then
    v_is_allowed :=
      v_rule.approver_user_id = auth.uid()
      or public.can_manage_organization(v_request.organization_id);
  elsif v_rule_found and v_rule.approver_role is not null then
    v_is_allowed := public.has_org_role(v_request.organization_id, array[v_rule.approver_role]);
  else
    v_is_allowed := public.can_approve(v_request.organization_id);
  end if;

  if not v_is_allowed then
    return query select false, v_request.id, v_request.customer_quote_id, null::text, 'Not authorized to resolve approval request'::text;
    return;
  end if;

  update public.approval_requests
  set
    status = decision,
    approver_user_id = auth.uid(),
    comments = decision_comments,
    resolved_at = now()
  where id = v_request.id;

  perform set_config('app.approval_request_rpc_authorized', 'on', true);

  update public.customer_quotes
  set
    approval_status = decision,
    approved_by = case when decision = 'approved' then auth.uid() else approved_by end
  where id = v_quote.id;

  insert into public.activity_logs (organization_id, rfq_id, user_id, action, details)
  values (
    v_request.organization_id,
    v_quote.rfq_id,
    auth.uid(),
    'approval_request_resolved',
    jsonb_build_object(
      'approval_request_id', v_request.id,
      'customer_quote_id', v_quote.id,
      'decision', decision,
      'comments', decision_comments
    )
  );

  return query select true, v_request.id, v_quote.id, decision, null::text;
exception
  when others then
    return query select false, request_id, null::uuid, null::text, sqlerrm::text;
end;
$$;

revoke all on function public.resolve_approval_request(uuid, text, text) from public;
revoke all on function public.resolve_approval_request(uuid, text, text) from anon;
grant execute on function public.resolve_approval_request(uuid, text, text) to authenticated;
