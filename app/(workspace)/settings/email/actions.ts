"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ImapConnectionActionState = {
  error: string;
  success: string;
};

const initialState: ImapConnectionActionState = {
  error: "",
  success: "",
};

const adminRoles = new Set(["owner", "admin"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numeric(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

export async function saveImapConnectionAction(
  _previousState: ImapConnectionActionState,
  formData: FormData,
): Promise<ImapConnectionActionState> {
  const user = await requireUser();
  const organization = await requireOrganization();

  if (!adminRoles.has(organization.role)) {
    return {
      ...initialState,
      error:
        "Only organization owners and admins can update email connection settings.",
    };
  }

  const mailboxEmail = text(formData, "mailboxEmail");
  const imapHost = text(formData, "imapHost");
  const imapPort = Math.max(1, Math.trunc(numeric(formData, "imapPort", 993)));
  const imapSecure = formData.get("imapSecure") === "on";
  const imapUsername = text(formData, "imapUsername");
  const password = text(formData, "imapPassword");
  const scanFolder = text(formData, "scanFolder") || "INBOX";
  const onlyUnread = formData.get("onlyUnread") === "on";
  const isActive = formData.get("isActive") === "on";

  if (!mailboxEmail) return { ...initialState, error: "Mailbox email is required." };
  if (!imapHost) return { ...initialState, error: "IMAP host is required." };
  if (!imapUsername) return { ...initialState, error: "Username is required." };

  const supabase = await createClient();
  const { data: existingConnection, error: lookupError } = await supabase
    .from("email_connections")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("provider", "imap")
    .maybeSingle();

  if (lookupError) return { ...initialState, error: lookupError.message };

  const payload = {
    mailbox_email: mailboxEmail,
    imap_host: imapHost,
    imap_port: imapPort,
    imap_secure: imapSecure,
    imap_username: imapUsername,
    scan_folder: scanFolder,
    only_unread: onlyUnread,
    is_active: isActive,
  };

  const response = existingConnection
    ? await supabase
        .from("email_connections")
        .update({
          ...payload,
          // TODO: Encrypt IMAP credentials before production.
          ...(password ? { imap_password_encrypted: password } : {}),
        })
        .eq("id", existingConnection.id)
        .eq("organization_id", organization.id)
        .eq("provider", "imap")
    : await supabase.from("email_connections").insert({
        organization_id: organization.id,
        provider: "imap",
        created_by: user.id,
        ...payload,
        // TODO: Encrypt IMAP credentials before production.
        ...(password ? { imap_password_encrypted: password } : {}),
      });

  if (response.error) return { ...initialState, error: response.error.message };

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    user_id: user.id,
    action: "IMAP email connection updated",
    details: {
      mailbox_email: mailboxEmail,
      imap_host: imapHost,
      imap_port: imapPort,
      scan_folder: scanFolder,
      only_unread: onlyUnread,
      is_active: isActive,
    },
  });

  if (activityError) {
    console.error("Activity log insert failed", activityError.message);
  }

  revalidatePath("/settings/email");
  return { error: "", success: "IMAP email connection saved." };
}
