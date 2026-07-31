alter table public.email_connections
add column if not exists provider text;

alter table public.email_connections
add column if not exists mailbox_email text;

alter table public.email_connections
add column if not exists access_token text;

alter table public.email_connections
add column if not exists refresh_token text;

alter table public.email_connections
add column if not exists token_expires_at timestamptz;

alter table public.email_connections
add column if not exists graph_delta_link text;

alter table public.email_connections
add column if not exists is_active boolean default true;

alter table public.email_connections
add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.email_messages
add column if not exists email_connection_id uuid references public.email_connections(id) on delete cascade;

alter table public.email_messages
add column if not exists provider_message_id text;

alter table public.email_messages
add column if not exists conversation_id text;

alter table public.email_messages
add column if not exists from_email text;

alter table public.email_messages
add column if not exists from_name text;

alter table public.email_messages
add column if not exists subject text;

alter table public.email_messages
add column if not exists body_preview text;

alter table public.email_messages
add column if not exists received_at timestamptz;

alter table public.email_messages
add column if not exists has_attachments boolean default false;

alter table public.email_messages
add column if not exists matched_keywords text[];

alter table public.email_messages
add column if not exists classification text default 'unreviewed';

alter table public.email_messages
add column if not exists classification_reason text;

alter table public.email_messages
add column if not exists rfq_id uuid references public.rfqs(id) on delete set null;

alter table public.email_messages
add column if not exists raw_payload jsonb;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.email_messages'::regclass
    and confrelid = 'public.email_connections'::regclass
    and contype = 'f'
    and array_length(conkey, 1) = 1
    and conkey[1] = (
      select attnum
      from pg_attribute
      where attrelid = 'public.email_messages'::regclass
        and attname = 'email_connection_id'
    )
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.email_messages drop constraint %I', constraint_name);
  end if;

  alter table public.email_messages
  add constraint email_messages_email_connection_id_fkey
  foreign key (email_connection_id)
  references public.email_connections(id)
  on delete cascade;
end $$;
