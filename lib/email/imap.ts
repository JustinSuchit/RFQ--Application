import { ImapFlow, type MailboxObject } from "imapflow";
import { simpleParser } from "mailparser";
import { classifyRfqEmail, type RfqClassification } from "@/lib/email/rfq-classifier";
import {
  fallbackThreadKey,
  normalizeEmailSubject,
  normalizeMessageId,
  normalizeReferences,
  threadPositionFromDate,
} from "@/lib/email/threading";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseClientLike = SupabaseClient;

export type ImapConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  mailbox_email: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
  scan_folder: string | null;
  only_unread: boolean | null;
  last_uid: number | null;
  last_processed_uid?: number | null;
  last_uid_validity?: number | null;
  last_scan_at: string | null;
  auto_scan_enabled?: boolean | null;
  scan_interval_minutes?: number | null;
  is_active: boolean | null;
};

export type ImapTestResult = {
  success: true;
  mailbox: string;
  exists: number;
  unseen: number;
};

export type ImapScanSummary = {
  scanned: number;
  insertedOrUpdated: number;
  likelyRfq: number;
  possibleRfq: number;
  skippedNotRfq: number;
  duplicates: number;
  attachmentCount: number;
  highestUid: number | null;
  uidValidity: number | null;
  folder: string;
};

type ParsedScannedMessage = {
  uid: number;
  flags: string[];
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  hasAttachments: boolean;
  attachmentCount: number;
  classification: RfqClassification;
  matchedKeywords: string[];
  classificationReason: string;
  messageIdHeader: string | null;
  inReplyToHeader: string | null;
  referencesHeader: string[];
  normalizedSubject: string;
  threadKey: string;
  parentEmailId: string | null;
  linkedRfqId: string | null;
};

type ParsedMailWithHeaders = {
  headers?: {
    get(name: string): unknown;
  };
};

export type ImapErrorDetails = {
  message: string;
  code?: string;
  command?: string;
  response?: string;
  responseText?: string;
  serverResponse?: string;
  authenticationFailed: boolean;
};

export class ImapOperationError extends Error {
  details: ImapErrorDetails;

  constructor(details: ImapErrorDetails) {
    super(details.message);
    this.name = "ImapOperationError";
    this.details = details;
    this.code = details.code;
    this.command = details.command;
    this.response = details.response;
    this.responseText = details.responseText;
    this.serverResponse = details.serverResponse;
    this.authenticationFailed = details.authenticationFailed;
  }

  code?: string;
  command?: string;
  response?: string;
  responseText?: string;
  serverResponse?: string;
  authenticationFailed: boolean;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getImapErrorDetails(error: unknown): ImapErrorDetails {
  const err = error as {
    message?: unknown;
    code?: unknown;
    command?: unknown;
    response?: unknown;
    responseText?: unknown;
    serverResponse?: unknown;
    authenticationFailed?: unknown;
    details?: ImapErrorDetails;
  };

  if (err?.details) {
    return err.details;
  }

  return {
    message: err?.message ? String(err.message) : String(error),
    code: err?.code ? String(err.code) : undefined,
    command: err?.command ? String(err.command) : undefined,
    response: err?.response ? String(err.response) : undefined,
    responseText: err?.responseText ? String(err.responseText) : undefined,
    serverResponse: err?.serverResponse ? String(err.serverResponse) : undefined,
    authenticationFailed: Boolean(err?.authenticationFailed),
  };
}

export function normalizeImapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("auth") || lower.includes("login") || lower.includes("credentials")) {
    return "Invalid username or password for the IMAP mailbox.";
  }

  if (lower.includes("enotfound") || lower.includes("getaddrinfo") || lower.includes("dns")) {
    return "Invalid IMAP host. Check the mailbox server name.";
  }

  if (lower.includes("certificate") || lower.includes("tls") || lower.includes("ssl")) {
    return "TLS/SSL connection issue. Check the host, port, and SSL/TLS setting.";
  }

  if (lower.includes("mailbox") || lower.includes("folder") || lower.includes("not found")) {
    return "Folder not found. Check the scan folder name.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "IMAP connection timed out. Check the host and port.";
  }

  return message || "Unable to connect to the IMAP mailbox.";
}

export function validateImapConnection(connection: ImapConnectionRow | null) {
  if (!connection) {
    return "No active IMAP connection configured. Save the IMAP connection first.";
  }

  if (!connection.imap_host) return "Missing IMAP host.";
  if (!connection.imap_port) return "Missing IMAP port.";
  if (!connection.imap_username) return "Missing IMAP username.";
  if (!connection.imap_password_encrypted) {
    return "Missing IMAP password or app password.";
  }
  if (!connection.scan_folder) return "Missing scan folder.";

  return "";
}

function createImapClient(connection: ImapConnectionRow) {
  const host = connection.imap_host!;
  const username = connection.imap_username!;
  const password = connection.imap_password_encrypted!;

  return new ImapFlow({
    host,
    port: connection.imap_port ?? 993,
    secure: connection.imap_secure ?? true,
    auth: {
      user: username,
      pass: password,
    },
    clientInfo: {
      name: "ProcureFlow RFQ SaaS",
      vendor: "ProcureFlow",
    },
    connectionTimeout: 20000,
    greetingTimeout: 12000,
    disableAutoIdle: true,
    logger: false,
  });
}

async function connectAndOpenMailbox(connection: ImapConnectionRow) {
  const validationError = validateImapConnection(connection);
  if (validationError) throw new Error(validationError);

  const client = createImapClient(connection);
  const mailboxName = connection.scan_folder!;

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(mailboxName, { readOnly: true });
    return { client, mailbox, mailboxName };
  } catch (error) {
    try {
      await client.logout();
    } catch {
      // Connection may not be established enough to log out cleanly.
    }

    throw new ImapOperationError(getImapErrorDetails(error));
  }
}

export async function getActiveImapConnectionForOrganization(
  supabase: SupabaseClientLike,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("email_connections")
    .select(
      "id, organization_id, provider, mailbox_email, imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted, scan_folder, only_unread, last_uid, last_processed_uid, last_uid_validity, last_scan_at, auto_scan_enabled, scan_interval_minutes, is_active",
    )
    .eq("organization_id", organizationId)
    .in("provider", ["imap", "custom_imap"])
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ImapConnectionRow | null;
}

export async function testImapConnection(
  connection: ImapConnectionRow,
): Promise<ImapTestResult> {
  const validationError = validateImapConnection(connection);
  if (validationError) throw new Error(validationError);

  const client = createImapClient(connection);
  const scanFolder = connection.scan_folder!;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(scanFolder, { readOnly: true });

    try {
      const status = client.mailbox;
      if (!status) {
        throw new Error("Folder not found. Check the scan folder name.");
      }

      return {
        success: true,
        mailbox: scanFolder,
        exists: status?.exists ?? 0,
        unseen: await getUnseenCount(client, status),
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    throw new ImapOperationError(getImapErrorDetails(error));
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore logout failures after a failed connection attempt.
    }
  }
}

export async function openImapMailbox(
  connection: ImapConnectionRow,
) {
  const { client, mailbox, mailboxName } = await connectAndOpenMailbox(connection);

  try {
    return {
      success: true,
      mailbox: mailboxName,
      exists: mailbox.exists,
      unseen: await getUnseenCount(client, mailbox),
    };
  } finally {
    await client.logout();
  }
}

async function getUnseenCount(client: ImapFlow, mailbox: MailboxObject) {
  if (mailbox.exists === 0) return 0;

  const unseen = await client.search({ seen: false }, { uid: true });
  return Array.isArray(unseen) ? unseen.length : 0;
}

function latestUids(uids: number[], limit: number) {
  return [...uids]
    .sort((left, right) => left - right)
    .slice(Math.max(0, uids.length - limit));
}

async function getUidsToScan(client: ImapFlow, connection: ImapConnectionRow) {
  const lastUid = connection.last_processed_uid ?? connection.last_uid ?? null;
  const baseQuery = connection.only_unread ? { seen: false } : { all: true };
  const searchResult = await client.search(
    lastUid
      ? { ...baseQuery, uid: `${lastUid + 1}:*` }
      : baseQuery,
    { uid: true },
  );
  const uids = Array.isArray(searchResult) ? searchResult : [];
  const filtered = lastUid ? uids.filter((uid) => uid > lastUid) : latestUids(uids, 50);

  return filtered.sort((left, right) => left - right);
}

async function parseScannedMessage(
  uid: number,
  source: Buffer,
  flags: Set<string> | undefined,
  connection: ImapConnectionRow,
  supabase: SupabaseClientLike,
): Promise<ParsedScannedMessage> {
  const parsed = await simpleParser(source);
  const firstSender = parsed.from?.value?.[0];
  const fromEmail = firstSender?.address || "unknown@example.invalid";
  const fromName = firstSender?.name || null;
  const subject = parsed.subject || "(No subject)";
  const rawBody = parsed.text || "";
  const rawHtml = typeof parsed.html === "string" ? parsed.html : null;
  const bodyPreview = rawBody.replace(/\s+/g, " ").trim().slice(0, 1000);
  const attachments = parsed.attachments ?? [];
  const receivedAt = (parsed.date ?? new Date()).toISOString();
  const headers = (parsed as ParsedMailWithHeaders).headers;
  const messageIdHeader = normalizeMessageId(headers?.get("message-id") as string | null | undefined);
  const inReplyToHeader = normalizeMessageId(headers?.get("in-reply-to") as string | null | undefined);
  const referencesHeader = normalizeReferences(
    headers?.get("references") as string | string[] | null | undefined,
  );
  const normalizedSubject = normalizeEmailSubject(subject);
  const thread = await resolveEmailThread({
    supabase,
    organizationId: connection.organization_id,
    subject,
    normalizedSubject,
    fromEmail,
    bodyPreview,
    messageIdHeader,
    inReplyToHeader,
    referencesHeader,
    receivedAt,
  });
  let classification;

  try {
    classification = classifyRfqEmail(subject, bodyPreview);
  } catch {
    classification = {
      classification: "possible_rfq" as const,
      matchedKeywords: [],
      reason: "Classifier failed, so this email was kept for review.",
    };
  }

  return {
    uid,
    flags: Array.from(flags ?? []),
    fromEmail,
    fromName,
    subject,
    bodyPreview,
    bodyText: rawBody.trim() || null,
    bodyHtml: rawHtml,
    receivedAt,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    classification: classification.classification,
    matchedKeywords: classification.matchedKeywords,
    classificationReason: classification.reason,
    messageIdHeader,
    inReplyToHeader,
    referencesHeader,
    normalizedSubject,
    threadKey: thread.threadKey,
    parentEmailId: thread.parentEmailId,
    linkedRfqId: thread.rfqId,
  };
}

async function resolveEmailThread({
  supabase,
  organizationId,
  subject,
  normalizedSubject,
  fromEmail,
  bodyPreview,
  messageIdHeader,
  inReplyToHeader,
  referencesHeader,
  receivedAt,
}: {
  supabase: SupabaseClientLike;
  organizationId: string;
  subject: string;
  normalizedSubject: string;
  fromEmail: string;
  bodyPreview: string;
  messageIdHeader: string | null;
  inReplyToHeader: string | null;
  referencesHeader: string[];
  receivedAt: string;
}) {
  const referencedIds = [inReplyToHeader, ...referencesHeader].filter(
    (value): value is string => Boolean(value),
  );

  if (referencedIds.length > 0) {
    const { data } = await supabase
      .from("email_messages")
      .select("id, thread_key, rfq_id")
      .eq("organization_id", organizationId)
      .in("message_id_header", referencedIds)
      .order("received_at", { ascending: false })
      .limit(1);
    const parent = data?.[0];
    if (parent?.thread_key) {
      return {
        threadKey: parent.thread_key as string,
        parentEmailId: parent.id as string,
        rfqId: (parent.rfq_id as string | null) ?? null,
      };
    }
  }

  const received = new Date(receivedAt);
  const windowStart = new Date(received.getTime() - 14 * 24 * 60 * 60_000).toISOString();
  const windowEnd = new Date(received.getTime() + 14 * 24 * 60 * 60_000).toISOString();
  const domain = fromEmail.split("@")[1]?.toLowerCase();

  if (normalizedSubject && normalizedSubject !== "request for quote" && domain) {
    const { data } = await supabase
      .from("email_messages")
      .select("id, thread_key, rfq_id, from_email")
      .eq("organization_id", organizationId)
      .eq("normalized_subject", normalizedSubject)
      .gte("received_at", windowStart)
      .lte("received_at", windowEnd)
      .order("received_at", { ascending: false })
      .limit(20);
    const match = data?.find((email) =>
      String(email.from_email ?? "").toLowerCase().endsWith(`@${domain}`),
    );
    if (match?.thread_key) {
      return {
        threadKey: match.thread_key as string,
        parentEmailId: match.id as string,
        rfqId: (match.rfq_id as string | null) ?? null,
      };
    }
  }

  return {
    threadKey:
      messageIdHeader ??
      fallbackThreadKey({
        organizationId,
        subject,
        fromEmail,
        body: bodyPreview,
      }),
    parentEmailId: null,
    rfqId: null,
  };
}

export async function scanImapInbox(
  supabase: SupabaseClientLike,
  connection: ImapConnectionRow,
): Promise<ImapScanSummary> {
  const { client, mailbox, mailboxName } = await connectAndOpenMailbox(connection);

  try {
    const uidValidityValue = (mailbox as { uidValidity?: unknown; uidvalidity?: unknown }).uidValidity ??
      (mailbox as { uidValidity?: unknown; uidvalidity?: unknown }).uidvalidity;
    const uidValidity = uidValidityValue ? Number(uidValidityValue) : null;
    const uidValidityChanged =
      Boolean(connection.last_uid_validity && uidValidity) &&
      Number(connection.last_uid_validity) !== Number(uidValidity);
    const scanConnection = uidValidityChanged
      ? { ...connection, last_uid: null, last_processed_uid: null }
      : connection;

    if (mailbox.exists === 0) {
      throw new Error("Mailbox has no messages.");
    }

    const uids = await getUidsToScan(client, scanConnection);

    if (uids.length === 0) {
      await supabase
        .from("email_connections")
        .update({
          last_scan_at: new Date().toISOString(),
          last_uid_validity: uidValidity,
        })
        .eq("id", connection.id)
        .eq("organization_id", connection.organization_id);

      return {
        scanned: 0,
        insertedOrUpdated: 0,
        likelyRfq: 0,
        possibleRfq: 0,
        skippedNotRfq: 0,
        duplicates: 0,
        attachmentCount: 0,
        highestUid: connection.last_processed_uid ?? connection.last_uid ?? null,
        uidValidity,
        folder: mailboxName,
      };
    }

    const scannedMessages: ParsedScannedMessage[] = [];

    for await (const message of client.fetch(
      uids,
      { uid: true, source: true, flags: true },
      { uid: true },
    )) {
      if (message.source) {
        try {
          scannedMessages.push(
            await parseScannedMessage(
              message.uid,
              message.source,
              message.flags,
              connection,
              supabase,
            ),
          );
        } catch (error) {
          console.warn("IMAP message parse failed", {
            uid: message.uid,
            error: getErrorMessage(error),
          });
        }
      }
    }

    const checkpointBase = connection.last_processed_uid ?? connection.last_uid ?? 0;
    const highestUid = scannedMessages.reduce(
      (currentHighest, message) => Math.max(currentHighest, message.uid),
      checkpointBase,
    );
    const nextProcessedUid = highestUid || checkpointBase || null;

    let insertedOrUpdated = 0;
    let likelyRfq = 0;
    let possibleRfq = 0;
    let skippedNotRfq = 0;
    let duplicates = 0;
    let attachmentCount = 0;

    for (const message of scannedMessages) {
      attachmentCount += message.attachmentCount;
      if (message.classification === "likely_rfq") likelyRfq += 1;
      if (message.classification === "possible_rfq") possibleRfq += 1;
      if (message.classification === "not_rfq") {
        skippedNotRfq += 1;
        continue;
      }

      const providerMessageId = `imap-${connection.id}-${mailboxName}-${message.uid}`;
      const { data: existingMessage, error: existingMessageError } = await supabase
        .from("email_messages")
        .select("id")
        .eq("organization_id", connection.organization_id)
        .eq("email_connection_id", connection.id)
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

      if (existingMessageError) {
        console.warn("IMAP duplicate lookup failed", existingMessageError.message);
      }

      if (existingMessage) {
        duplicates += 1;
        continue;
      }

      const { error } = await supabase.from("email_messages").upsert(
        {
          organization_id: connection.organization_id,
          provider: "imap",
          provider_message_id: providerMessageId,
          email_connection_id: connection.id,
          conversation_id: null,
          message_id_header: message.messageIdHeader,
          in_reply_to_header: message.inReplyToHeader,
          references_header: message.referencesHeader,
          normalized_subject: message.normalizedSubject,
          thread_key: message.threadKey,
          thread_position: threadPositionFromDate(message.receivedAt),
          parent_email_id: message.parentEmailId,
          from_email: message.fromEmail,
          from_name: message.fromName,
          subject: message.subject,
          body_preview: message.bodyPreview,
          body: message.bodyText ?? message.bodyPreview,
          body_text: message.bodyText,
          body_html: message.bodyHtml,
          received_at: message.receivedAt,
          has_attachments: message.hasAttachments,
          matched_keywords: message.matchedKeywords,
          classification: message.classification,
          classification_reason: message.classificationReason,
          is_rfq: message.classification === "likely_rfq" ? true : null,
          rfq_id: message.linkedRfqId,
          raw_payload: {
            uid: message.uid,
            flags: message.flags,
            mailbox: mailboxName,
            provider: "imap",
            attachment_count: message.attachmentCount,
          },
        },
        { onConflict: "organization_id,provider_message_id" },
      );

      if (error) {
        console.warn("IMAP email message save failed", {
          uid: message.uid,
          error: error.message,
        });
        continue;
      }

      insertedOrUpdated += 1;

      if (message.linkedRfqId) {
        await supabase
          .from("rfqs")
          .update({
            last_activity_at: message.receivedAt,
            next_action: "Review new email reply",
            review_status: "needs_review",
          })
          .eq("id", message.linkedRfqId)
          .eq("organization_id", connection.organization_id);
      }
    }

    await supabase
      .from("email_connections")
      .update({
        last_uid: nextProcessedUid,
        last_processed_uid: nextProcessedUid,
        last_uid_validity: uidValidity,
        last_scan_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("organization_id", connection.organization_id);

    return {
      scanned: scannedMessages.length,
      insertedOrUpdated,
      likelyRfq,
      possibleRfq,
      skippedNotRfq,
      duplicates,
      attachmentCount,
      highestUid: nextProcessedUid,
      uidValidity,
      folder: mailboxName,
    };
  } catch (error) {
    if (error instanceof ImapOperationError) {
      throw error;
    }

    throw new Error(getErrorMessage(error));
  } finally {
    await client.logout();
  }
}
