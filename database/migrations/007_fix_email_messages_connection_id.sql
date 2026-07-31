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
add column if not exists classification text not null default 'unreviewed';

alter table public.email_messages
add column if not exists classification_reason text;

alter table public.email_messages
add column if not exists rfq_id uuid references public.rfqs(id) on delete set null;

alter table public.email_messages
add column if not exists raw_payload jsonb;

alter table public.email_messages
add column if not exists created_at timestamptz not null default now();
