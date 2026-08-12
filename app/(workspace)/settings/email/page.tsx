import Link from "next/link";
import { PlugZap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  ImapConnectionSettings,
  type ImapConnection,
} from "@/components/settings/imap-connection-settings";
import {
  MicrosoftConnectionSettings,
  type MicrosoftConnection,
} from "@/components/settings/microsoft-connection-settings";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
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
    <div style={pageThemeStyle("integrations")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="integrations"
        icon={PlugZap}
        eyebrow="Email intake"
        title="Email Settings"
        description="Configure mailbox intake while keeping manual email logging available for RFQ review and conversion."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
          >
            Back to settings
          </Link>
          <Link
            href="/settings/email/monitoring"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] px-4 text-sm font-semibold text-[var(--page-accent)] shadow-sm transition hover:border-[var(--page-accent)]"
          >
            Open Scan Monitoring
          </Link>
        </div>
      </PageHeader>

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
