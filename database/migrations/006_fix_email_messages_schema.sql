alter table public.email_messages
add column if not exists classification_reason text;

alter table public.email_messages
add column if not exists matched_keywords text[];

alter table public.email_messages
add column if not exists raw_payload jsonb;

alter table public.email_messages
add column if not exists provider_message_id text;

alter table public.email_messages
add column if not exists conversation_id text;

alter table public.email_messages
add column if not exists has_attachments boolean default false;

alter table public.email_messages
add column if not exists rfq_id uuid references public.rfqs(id) on delete set null;
