import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  ImapConnectionSettings,
  type ImapConnection,
} from "@/components/settings/imap-connection-settings";
import {
  MicrosoftConnectionSettings,
  type MicrosoftConnection,
} from "@/components/settings/microsoft-connection-settings";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

export default async function EmailSettingsPage() {
  await requireUser();
  const currentOrganization = await requireOrganization();
  const supabase = await createClient();

  const [imapResponse, microsoftResponse] = await Promise.all([
    supabase
      .from("email_connections")
      .select(
        "id, provider, mailbox_email, imap_host, imap_port, imap_secure, imap_username, scan_folder, only_unread, is_active, last_uid, last_processed_uid, last_uid_validity, last_scan_at, auto_scan_enabled, scan_interval_minutes, next_scan_at, last_scan_status, last_scan_error, scan_in_progress, scan_started_at",
      )
      .eq("organization_id", currentOrganization.id)
      .eq("provider", "imap")
      .maybeSingle(),
    supabase
      .from("email_connections")
      .select("id, provider, mailbox_email, graph_scan_folder, graph_scan_folder_id, graph_last_scan_at, graph_last_message_received_at, is_active")
      .eq("organization_id", currentOrganization.id)
      .eq("provider", "microsoft_graph")
      .maybeSingle(),
  ]);

  const error = imapResponse.error ?? microsoftResponse.error;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          Back to settings
        </Link>
        <p className="mt-4 text-sm font-medium text-teal-700">
          Email intake
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Email Settings
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Configure mailbox intake while keeping manual email logging available
          for RFQ review and conversion.
        </p>
      </div>

      {error ? (
        <Card className="p-6">
          <p className="text-sm font-medium text-rose-700">{error.message}</p>
        </Card>
      ) : null}

      <MicrosoftConnectionSettings
        connection={(microsoftResponse.data ?? null) as MicrosoftConnection | null}
        canManage={adminRoles.has(currentOrganization.role)}
      />

      <ImapConnectionSettings
        connection={(imapResponse.data ?? null) as ImapConnection | null}
        canManage={adminRoles.has(currentOrganization.role)}
      />
    </div>
  );
}
