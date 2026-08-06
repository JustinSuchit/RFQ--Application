import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  getActiveImapConnectionForOrganization,
  getImapErrorDetails,
  validateImapConnection,
} from "@/lib/email/imap";
import { scanImapConnection } from "@/lib/email/scan-imap-connection";
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

    if (!["owner", "admin", "manager", "procurement"].includes(organization.role)) {
      return Response.json(
        {
          success: false,
          error: "You do not have permission to scan the IMAP inbox.",
        },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const connection = await getActiveImapConnectionForOrganization(
      supabase,
      organization.id,
    );

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

    const summary = await scanImapConnection({
      supabase,
      connectionId: connection.id,
      organizationId: organization.id,
      trigger: "manual",
      userId: user.id,
    });

    revalidatePath("/email-intake");
    revalidatePath("/rfqs");
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
