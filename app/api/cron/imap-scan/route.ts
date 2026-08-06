import { scanImapConnection } from "@/lib/email/scan-imap-connection";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STALE_SCAN_LOCK_MINUTES = 15;

function unauthorized() {
  return Response.json({ success: false, error: "Unauthorized." }, { status: 401 });
}

function assertCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret || authorization !== `Bearer ${secret}`) {
    return false;
  }

  return true;
}

async function runScheduledImapScans(request: Request) {
  if (!assertCronAuthorized(request)) {
    return unauthorized();
  }

  let supabase;

  try {
    supabase = createAdminClient();
  } catch {
    return Response.json(
      {
        success: false,
        error: "Server cron Supabase credentials are not configured.",
      },
      { status: 500 },
    );
  }
  const now = new Date().toISOString();
  const staleCutoff = new Date(
    Date.now() - STALE_SCAN_LOCK_MINUTES * 60_000,
  ).toISOString();

  const { data: connections, error } = await supabase
    .from("email_connections")
    .select("id, organization_id, mailbox_email, scan_folder")
    .in("provider", ["imap", "custom_imap"])
    .eq("is_active", true)
    .eq("auto_scan_enabled", true)
    .or(`next_scan_at.is.null,next_scan_at.lte.${now}`)
    .or(`scan_in_progress.eq.false,scan_in_progress.is.null,scan_started_at.lt.${staleCutoff},scan_started_at.is.null`)
    .order("next_scan_at", { ascending: true, nullsFirst: true })
    .limit(25);

  if (error) {
    return Response.json(
      { success: false, error: "Unable to load due IMAP connections." },
      { status: 500 },
    );
  }

  const results = [];

  for (const connection of connections ?? []) {
    try {
      const summary = await scanImapConnection({
        supabase,
        connectionId: connection.id,
        organizationId: connection.organization_id,
        trigger: "scheduled",
      });

      results.push({
        connectionId: connection.id,
        organizationId: connection.organization_id,
        success: true,
        scanned: summary.scanned,
        imported: summary.insertedOrUpdated,
        skippedNotRfq: summary.skippedNotRfq,
        duplicates: summary.duplicates,
        highestUid: summary.highestUid,
      });
    } catch (scanError) {
      results.push({
        connectionId: connection.id,
        organizationId: connection.organization_id,
        success: false,
        error: scanError instanceof Error ? scanError.message : String(scanError),
      });
    }
  }

  return Response.json({
    success: true,
    dueConnections: connections?.length ?? 0,
    scannedConnections: results.filter((result) => result.success).length,
    failedConnections: results.filter((result) => !result.success).length,
    results,
  });
}

export async function GET(request: Request) {
  return runScheduledImapScans(request);
}

export async function POST(request: Request) {
  return runScheduledImapScans(request);
}
