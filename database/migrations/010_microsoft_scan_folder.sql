alter table public.email_connections
add column if not exists graph_scan_folder text default 'inbox';

alter table public.email_connections
add column if not exists graph_scan_folder_id text;

alter table public.email_connections
add column if not exists graph_last_scan_at timestamptz;

alter table public.email_connections
add column if not exists graph_last_message_received_at timestamptz;
