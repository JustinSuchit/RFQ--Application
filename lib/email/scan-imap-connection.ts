import {
  getErrorMessage,
  scanImapInbox,
  type ImapConnectionRow,
  type ImapScanSummary,
  type SupabaseClientLike,
  validateImapConnection,
} from "@/lib/email/imap";

export type ImapScanTrigger = "manual" | "scheduled";

export type ScanImapConnectionInput = {
  supabase: SupabaseClientLike;
  connectionId: string;
  organizationId: string;
  trigger: ImapScanTrigger;
  userId?: string | null;
};

export type ScanImapConnectionResult = ImapScanSummary & {
  trigger: ImapScanTrigger;
  status: "completed";
};

const STALE_SCAN_LOCK_MINUTES = 15;

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function staleLockCutoff() {
  return new Date(Date.now() - STALE_SCAN_LOCK_MINUTES * 60_000).toISOString();
}

function nextScanAt(connection: ImapConnectionRow) {
  if (!connection.auto_scan_enabled) return null;
  const interval = Math.max(60, connection.scan_interval_minutes ?? 60);
  return minutesFromNow(interval);
}

async function loadConnection(
  supabase: SupabaseClientLike,
  connectionId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("email_connections")
    .select(
      "id, organization_id, provider, mailbox_email, imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted, scan_folder, only_unread, last_uid, last_processed_uid, last_uid_validity, last_scan_at, auto_scan_enabled, scan_interval_minutes, is_active, scan_in_progress, scan_started_at",
    )
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .in("provider", ["imap", "custom_imap"])
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as (ImapConnectionRow & {
    scan_in_progress?: boolean | null;
    scan_started_at?: string | null;
  }) | null;
}

async function writeActivityLog(
  supabase: SupabaseClientLike,
  input: ScanImapConnectionInput,
  connection: ImapConnectionRow,
  status: "completed" | "failed",
  details: Record<string, unknown>,
) {
  const action =
    input.trigger === "scheduled"
      ? `Scheduled IMAP mailbox scan ${status}`
      : `Manual IMAP mailbox scan ${status}`;

  const { error } = await supabase.from("activity_logs").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    action,
    details: {
      provider: connection.provider,
      mailbox_email: connection.mailbox_email,
      scan_folder: connection.scan_folder,
      trigger: input.trigger,
      ...details,
    },
  });

  if (error) {
    console.error("Activity log insert failed", error.message);
  }
}

export async function scanImapConnection(
  input: ScanImapConnectionInput,
): Promise<ScanImapConnectionResult> {
  const connection = await loadConnection(
    input.supabase,
    input.connectionId,
    input.organizationId,
  );

  const validationError = validateImapConnection(connection);
  if (validationError) throw new Error(validationError);
  if (!connection) throw new Error("No active IMAP connection configured.");

  const staleCutoff = staleLockCutoff();
  const lockResponse = await input.supabase
    .from("email_connections")
    .update({
      scan_in_progress: true,
      scan_started_at: new Date().toISOString(),
      last_scan_status: "running",
      last_scan_error: null,
    })
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId)
    .in("provider", ["imap", "custom_imap"])
    .or(`scan_in_progress.eq.false,scan_in_progress.is.null,scan_started_at.lt.${staleCutoff},scan_started_at.is.null`)
    .select("id")
    .maybeSingle();

  if (lockResponse.error) throw new Error(lockResponse.error.message);
  if (!lockResponse.data) {
    throw new Error("An IMAP scan is already running for this mailbox.");
  }

  try {
    const summary = await scanImapInbox(input.supabase, connection);

    const { error: updateError } = await input.supabase
      .from("email_connections")
      .update({
        scan_in_progress: false,
        scan_started_at: null,
        last_scan_at: new Date().toISOString(),
        next_scan_at: nextScanAt(connection),
        last_scan_status: "completed",
        last_scan_error: null,
      })
      .eq("id", input.connectionId)
      .eq("organization_id", input.organizationId);

    if (updateError) throw new Error(updateError.message);

    await writeActivityLog(input.supabase, input, connection, "completed", {
      scanned: summary.scanned,
      imported: summary.insertedOrUpdated,
      likely_rfq: summary.likelyRfq,
      possible_rfq: summary.possibleRfq,
      skipped_not_rfq: summary.skippedNotRfq,
      duplicates: summary.duplicates,
      highest_uid: summary.highestUid,
      uid_validity: summary.uidValidity,
    });

    return { ...summary, trigger: input.trigger, status: "completed" };
  } catch (error) {
    const message = getErrorMessage(error);

    await input.supabase
      .from("email_connections")
      .update({
        scan_in_progress: false,
        scan_started_at: null,
        last_scan_at: new Date().toISOString(),
        next_scan_at: nextScanAt(connection),
        last_scan_status: "failed",
        last_scan_error: message.slice(0, 1000),
      })
      .eq("id", input.connectionId)
      .eq("organization_id", input.organizationId);

    await writeActivityLog(input.supabase, input, connection, "failed", {
      error: message.slice(0, 1000),
    });

    throw error;
  }
}
