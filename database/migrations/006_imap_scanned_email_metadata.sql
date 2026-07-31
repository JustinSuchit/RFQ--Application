-- ============================================================
-- IMAP Scanned Email Metadata
-- Extra nullable fields used by automated mailbox intake
-- ============================================================

alter table public.email_messages
add column if not exists email_connection_id uuid references public.email_connections(id) on delete set null,
add column if not exists conversation_id text,
add column if not exists matched_keywords text[],
add column if not exists classification_reason text,
add column if not exists raw_payload jsonb;

create index if not exists idx_email_messages_email_connection_id
on public.email_messages(email_connection_id);
