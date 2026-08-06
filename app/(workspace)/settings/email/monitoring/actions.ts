"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import {
  getActiveImapConnectionForOrganization,
  getImapErrorDetails,
  testImapConnection,
  validateImapConnection,
} from "@/lib/email/imap";
import { scanImapConnection } from "@/lib/email/scan-imap-connection";
import { createClient } from "@/lib/supabase/server";

export type ScanMonitoringState = {
  error: string;
  success?: string;
};

const adminRoles = new Set(["owner", "admin"]);

async function activeConnection() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const connection = await getActiveImapConnectionForOrganization(supabase, organization.id);
  return { organization, supabase, connection };
}

export async function runMonitoringScanAction(): Promise<ScanMonitoringState> {
  const user = await requireUser();
  const { organization, supabase, connection } = await activeConnection();
  const validationError = validateImapConnection(connection);
  if (validationError || !connection) {
    return { error: validationError || "No active IMAP connection configured." };
  }

  try {
    const summary = await scanImapConnection({
      supabase,
      connectionId: connection.id,
      organizationId: organization.id,
      trigger: "manual",
      userId: user.id,
    });

    revalidatePath("/settings/email/monitoring");
    revalidatePath("/email-intake");
    return {
      error: "",
      success: `Scan completed. Imported ${summary.insertedOrUpdated} email${summary.insertedOrUpdated === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    const details = getImapErrorDetails(error);
    return { error: details.message || "IMAP scan failed." };
  }
}

export async function testMonitoringConnectionAction(): Promise<ScanMonitoringState> {
  const { connection } = await activeConnection();
  const validationError = validateImapConnection(connection);
  if (validationError || !connection) {
    return { error: validationError || "No active IMAP connection configured." };
  }

  try {
    const result = await testImapConnection(connection);
    return {
      error: "",
      success: `Connection OK. ${result.exists} messages, ${result.unseen} unread in ${result.mailbox}.`,
    };
  } catch (error) {
    return { error: getImapErrorDetails(error).message || "Connection test failed." };
  }
}

export async function clearStaleScanLockAction(): Promise<ScanMonitoringState> {
  const user = await requireUser();
  const { organization, supabase, connection } = await activeConnection();
  if (!adminRoles.has(organization.role)) {
    return { error: "Only admins can clear stale scan locks." };
  }
  if (!connection) return { error: "No active IMAP connection configured." };

  const { error } = await supabase
    .from("email_connections")
    .update({
      scan_in_progress: false,
      scan_started_at: null,
      last_scan_status: "partial",
      last_scan_error: "Stale scan lock cleared manually.",
    })
    .eq("id", connection.id)
    .eq("organization_id", organization.id);

  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    user_id: user.id,
    action: "Stale scan lock cleared",
    details: {
      email_connection_id: connection.id,
      mailbox_email: connection.mailbox_email,
    },
  });
  revalidatePath("/settings/email/monitoring");
  return { error: "", success: "Stale scan lock cleared." };
}
