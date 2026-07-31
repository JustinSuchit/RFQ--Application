import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  getActiveImapConnectionForOrganization,
  getImapErrorDetails,
  scanImapInbox,
  validateImapConnection,
} from "@/lib/email/imap";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        { success: false, error: "Not authenticated. Please log in again." },
        { status: 401 },
      );
    }

    const organization = await getCurrentOrganization();

    if (!organization) {
      return Response.json(
        { success: false, error: "No active organization found." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const connection = await getActiveImapConnectionForOrganization(
      supabase,
      organization.id,
    );

    console.log("IMAP scan config", {
      hasConnection: Boolean(connection),
      provider: connection?.provider,
      isActive: connection?.is_active,
      host: connection?.imap_host,
      port: connection?.imap_port,
      secure: connection?.imap_secure,
      username: connection?.imap_username,
      hasPassword: Boolean(connection?.imap_password_encrypted),
      scanFolder: connection?.scan_folder,
    });

    const validationError = validateImapConnection(connection);
    if (validationError) {
      return Response.json(
        { success: false, error: validationError },
        { status: 400 },
      );
    }

    if (!connection) {
      return Response.json(
        {
          success: false,
          error:
            "No active IMAP connection configured. Save the IMAP connection first.",
        },
        { status: 400 },
      );
    }

    const summary = await scanImapInbox(supabase, connection);
    const { error: activityError } = await supabase.from("activity_logs").insert({
      organization_id: organization.id,
      user_id: user.id,
      action: "IMAP inbox scanned",
      details: {
        scanned: summary.scanned,
        imported: summary.insertedOrUpdated,
        skipped_not_rfq: summary.skippedNotRfq,
      },
    });

    if (activityError) {
      console.error("Activity log insert failed", activityError.message);
    }

    revalidatePath("/email-intake");
    revalidatePath("/settings/email");

    return Response.json({ success: true, ...summary });
  } catch (error) {
    const details = getImapErrorDetails(error);

    return Response.json(
      {
        success: false,
        error: "IMAP scan failed",
        details: details.message,
        diagnostics: {
          code: details.code,
          command: details.command,
          response: details.response,
          responseText: details.responseText,
          serverResponse: details.serverResponse,
          authenticationFailed: details.authenticationFailed,
        },
      },
      { status: 400 },
    );
  }
}
