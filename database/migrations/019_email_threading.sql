alter table public.email_messages
add column if not exists message_id_header text;

alter table public.email_messages
add column if not exists in_reply_to_header text;

alter table public.email_messages
add column if not exists references_header text[];

alter table public.email_messages
add column if not exists normalized_subject text;

alter table public.email_messages
add column if not exists thread_key text;

alter table public.email_messages
add column if not exists thread_position integer;

alter table public.email_messages
add column if not exists parent_email_id uuid references public.email_messages(id) on delete set null;

create index if not exists idx_email_messages_org_thread_key
on public.email_messages(organization_id, thread_key);

create index if not exists idx_email_messages_org_message_id_header
on public.email_messages(organization_id, message_id_header);

create index if not exists idx_email_messages_parent_email_id
on public.email_messages(parent_email_id);
