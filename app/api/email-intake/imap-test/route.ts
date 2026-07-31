import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  getActiveImapConnectionForOrganization,
  getImapErrorDetails,
  testImapConnection,
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

    console.log("IMAP test config", {
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

    return Response.json(await testImapConnection(connection));
  } catch (error) {
    const details = getImapErrorDetails(error);

    return Response.json(
      {
        success: false,
        error: "IMAP connection failed",
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
