# IMAP Hourly Scanning

The app supports automatic hourly scanning for the active IMAP mailbox while keeping the existing manual **Scan Inbox** button.

## Environment

Set a cron secret on the server:

```env
CRON_SECRET=replace-with-a-long-random-value
```

Scheduled scans also need server-side Supabase credentials because cron requests do not have a signed-in browser session:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code. It is only imported by the server-only cron route.

## Endpoint

The protected endpoint is:

```text
POST /api/cron/imap-scan
Authorization: Bearer <CRON_SECRET>
```

`GET` is also supported for cron providers that only support GET requests.

## Local Run

Start the app, then run:

```powershell
$env:CRON_SECRET="replace-with-the-same-secret"
$env:CRON_URL="http://localhost:3000"
npm run scan:imap
```

## Windows Task Scheduler

Create a task that runs every hour and executes PowerShell:

```powershell
$env:CRON_SECRET="replace-with-the-same-secret"; $env:CRON_URL="http://localhost:3000"; npm run scan:imap
```

For production, point `CRON_URL` to the deployed app URL.

## Behavior

- Only active IMAP connections with auto scan enabled are scanned.
- The interval is stored as `scan_interval_minutes` and defaults to 60.
- Manual scans and scheduled scans share the same scanner.
- A scan lock prevents overlapping scans.
- Locks older than 15 minutes are treated as stale and can be reclaimed.
- `last_processed_uid` and `last_uid_validity` are used for incremental IMAP scanning.
- The first scan imports only the latest 50 messages.
- Duplicate messages are skipped by `email_connection_id` and `provider_message_id`.
- The mailbox is opened read-only, so scans do not mark messages as read.
- Activity logs store scan summaries only. They do not store passwords, tokens, or private URLs.
