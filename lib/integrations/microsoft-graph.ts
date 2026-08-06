import { classifyRfqEmail } from "@/lib/email/rfq-classifier";

const scopes = ["offline_access", "User.Read", "Mail.Read"];

export type MicrosoftConnection = {
  id: string;
  organization_id: string;
  provider: string;
  mailbox_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  graph_scan_folder?: string | null;
  graph_scan_folder_id?: string | null;
  graph_last_scan_at?: string | null;
  graph_last_message_received_at?: string | null;
  is_active: boolean | null;
};

export type MicrosoftAuthState = {
  organizationId: string;
  userId: string;
};

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export type MicrosoftMe = {
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
};

export type MicrosoftGraphMessage = {
  id: string;
  conversationId: string | null;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    };
  };
  subject?: string | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  hasAttachments?: boolean | null;
};

export type MicrosoftGraphAttachment = {
  id: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
  isInline?: boolean | null;
  contentBytes?: string | null;
  "@odata.type"?: string;
};

export type MicrosoftScannedMessage = {
  providerMessageId: string;
  conversationId: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  hasAttachments: boolean;
  classification: "likely_rfq" | "possible_rfq" | "not_rfq";
  matchedKeywords: string[];
  classificationReason: string;
  rawPayload: Record<string, unknown>;
};

export type MicrosoftInboxScanResult = {
  messages: MicrosoftScannedMessage[];
  scanned: number;
  folder: string;
};

export type MicrosoftAttachmentDownload = {
  providerAttachmentId: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  contentBuffer: Buffer | null;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing Microsoft env var: ${name}`);
  }

  return value;
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function microsoftTenantId() {
  return requiredEnv("MICROSOFT_TENANT_ID");
}

function microsoftRedirectUri() {
  return requiredEnv("MICROSOFT_REDIRECT_URI");
}

function encodeState(state: MicrosoftAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeMicrosoftState(value: string): MicrosoftAuthState {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MicrosoftAuthState>;

  if (!parsed.organizationId || !parsed.userId) {
    throw new Error("Invalid Microsoft authorization state.");
  }

  return {
    organizationId: parsed.organizationId,
    userId: parsed.userId,
  };
}

function tokenExpiryIso(expiresIn: number) {
  return new Date(Date.now() + Math.max(0, expiresIn - 60) * 1000).toISOString();
}

export function getMicrosoftTokenExpiry(expiresIn: number) {
  return tokenExpiryIso(expiresIn);
}

async function parseGraphError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as {
      error?: string | { message?: string };
      error_description?: string;
    };
    const errorMessage =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? body.error_description;

    return errorMessage ? `${fallback}: ${errorMessage}` : fallback;
  } catch {
    return fallback;
  }
}

type MicrosoftMailFolder = {
  id: string;
  displayName?: string | null;
};

async function fetchMicrosoftMailFolders(
  accessToken: string,
  url: string,
  fallback: string,
) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await parseGraphError(response, fallback));
  }

  return (await response.json()) as { value?: MicrosoftMailFolder[] };
}

function normalizeFolderName(folderName: string) {
  return folderName.trim().toLowerCase();
}

export async function resolveMicrosoftMailFolderId(
  accessToken: string,
  folderName: string | null | undefined,
) {
  const requestedFolder = folderName?.trim() || "inbox";
  if (normalizeFolderName(requestedFolder) === "inbox") {
    return "inbox";
  }

  const topLevel = await fetchMicrosoftMailFolders(
    accessToken,
    "https://graph.microsoft.com/v1.0/me/mailFolders?$top=100",
    "Graph folder lookup failed",
  );
  const folders = topLevel.value ?? [];
  const directMatch = folders.find(
    (folder) =>
      folder.displayName &&
      normalizeFolderName(folder.displayName) === normalizeFolderName(requestedFolder),
  );

  if (directMatch) {
    return directMatch.id;
  }

  for (const folder of folders) {
    const children = await fetchMicrosoftMailFolders(
      accessToken,
      `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(folder.id)}/childFolders?$top=100`,
      "Graph folder lookup failed",
    );
    const childMatch = (children.value ?? []).find(
      (child) =>
        child.displayName &&
        normalizeFolderName(child.displayName) === normalizeFolderName(requestedFolder),
    );

    if (childMatch) {
      return childMatch.id;
    }
  }

  throw new Error(`Outlook folder "${requestedFolder}" was not found.`);
}

export function getMicrosoftAuthUrl({
  organizationId,
  userId,
}: MicrosoftAuthState) {
  const url = new URL(
    `https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/authorize`,
  );

  url.searchParams.set("client_id", requiredEnv("MICROSOFT_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", microsoftRedirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", encodeState({ organizationId, userId }));

  return url.toString();
}

export async function exchangeMicrosoftCodeForToken(
  code: string,
): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requiredEnv("MICROSOFT_CLIENT_SECRET"),
    code,
    redirect_uri: microsoftRedirectUri(),
    grant_type: "authorization_code",
    scope: scopes.join(" "),
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Token exchange failed"));
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

export async function getMicrosoftMe(accessToken: string): Promise<MicrosoftMe> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Graph /me failed"));
  }

  return (await response.json()) as MicrosoftMe;
}

export async function refreshMicrosoftAccessToken(
  connection: MicrosoftConnection,
): Promise<MicrosoftTokenResponse> {
  if (!connection.refresh_token) {
    throw new Error("Token refresh failed: missing refresh token.");
  }

  const body = new URLSearchParams({
    client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requiredEnv("MICROSOFT_CLIENT_SECRET"),
    refresh_token: connection.refresh_token,
    redirect_uri: microsoftRedirectUri(),
    grant_type: "refresh_token",
    scope: scopes.join(" "),
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Token refresh failed"));
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

export async function getValidMicrosoftAccessToken(
  connection: MicrosoftConnection,
) {
  if (!connection.access_token) {
    throw new Error("No Microsoft access token is stored for this connection.");
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  if (expiresAt > Date.now() + 60_000) {
    return { accessToken: connection.access_token, refreshed: null };
  }

  const refreshed = await refreshMicrosoftAccessToken(connection);
  return { accessToken: refreshed.access_token, refreshed };
}

export async function scanMicrosoftInbox(
  connection: MicrosoftConnection,
  accessToken?: string,
  folderId = "inbox",
): Promise<MicrosoftInboxScanResult> {
  const token = accessToken ?? connection.access_token;
  if (!token) {
    throw new Error("Graph folder scan failed: missing access token.");
  }

  const folderName = connection.graph_scan_folder?.trim() || "inbox";
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(folderId)}/messages?$top=25&$select=id,conversationId,from,subject,body,bodyPreview,receivedDateTime,hasAttachments&$orderby=receivedDateTime desc`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Graph folder scan failed"));
  }

  const body = (await response.json()) as { value?: MicrosoftGraphMessage[] };
  const messages = body.value ?? [];

  return {
    folder: folderName,
    scanned: messages.length,
    messages: messages.map((message) => {
      const subject = message.subject ?? "(No subject)";
      const graphBody = message.body?.content ?? "";
      const bodyContentType = (message.body?.contentType ?? "").toLowerCase();
      const bodyText = bodyContentType === "html" ? htmlToPlainText(graphBody) : graphBody.trim();
      const bodyHtml = bodyContentType === "html" ? graphBody : null;
      const bodyPreview = message.bodyPreview || bodyText.replace(/\s+/g, " ").slice(0, 1000);
      const classification = classifyRfqEmail(subject, bodyText || bodyPreview);
      const emailAddress = message.from?.emailAddress;

      return {
        providerMessageId: message.id,
        conversationId: message.conversationId ?? null,
        fromEmail: emailAddress?.address ?? "unknown@example.invalid",
        fromName: emailAddress?.name ?? null,
        subject,
        bodyPreview,
        bodyText: bodyText || null,
        bodyHtml,
        receivedAt: message.receivedDateTime ?? new Date().toISOString(),
        hasAttachments: Boolean(message.hasAttachments),
        classification: classification.classification,
        matchedKeywords: classification.matchedKeywords,
        classificationReason: classification.reason,
        rawPayload: {
          provider: "microsoft_graph",
          id: message.id,
          conversationId: message.conversationId ?? null,
        },
      };
    }),
  };
}

function looksLikeInlineSignatureAttachment(attachment: MicrosoftGraphAttachment) {
  const name = (attachment.name || "").toLowerCase();
  const contentType = (attachment.contentType || "").toLowerCase();
  const size = attachment.size ?? 0;

  if (attachment.isInline) return true;
  if (contentType === "image/png" && size > 0 && size < 50_000) return true;
  if (size > 0 && size < 10_000 && contentType.startsWith("image/")) return true;
  if (/\b(logo|signature|social|facebook|linkedin|instagram|tracking|pixel)\b/.test(name)) {
    return true;
  }

  return false;
}

export async function getMicrosoftMessageAttachments(
  accessToken: string,
  messageId: string,
): Promise<MicrosoftAttachmentDownload[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Graph attachment fetch failed"));
  }

  const body = (await response.json()) as { value?: MicrosoftGraphAttachment[] };
  return (body.value ?? [])
    .filter((attachment) => attachment["@odata.type"] === "#microsoft.graph.fileAttachment")
    .filter((attachment) => !looksLikeInlineSignatureAttachment(attachment))
    .map((attachment) => ({
      providerAttachmentId: attachment.id,
      fileName: attachment.name || `attachment-${attachment.id}`,
      contentType: attachment.contentType ?? null,
      sizeBytes: attachment.size ?? null,
      contentBuffer: attachment.contentBytes
        ? Buffer.from(attachment.contentBytes, "base64")
        : null,
    }));
}

export async function getMicrosoftMessageAttachmentContent(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<MicrosoftAttachmentDownload> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(await parseGraphError(response, "Microsoft attachment download failed"));
  }

  const attachment = (await response.json()) as MicrosoftGraphAttachment;

  if (attachment["@odata.type"] !== "#microsoft.graph.fileAttachment") {
    throw new Error("Microsoft attachment download failed: attachment is not a file attachment.");
  }

  if (looksLikeInlineSignatureAttachment(attachment)) {
    throw new Error("Microsoft attachment download skipped: attachment looks like an inline signature image.");
  }

  if (!attachment.contentBytes) {
    throw new Error("Attachment contentBytes missing.");
  }

  return {
    providerAttachmentId: attachment.id,
    fileName: attachment.name || `attachment-${attachment.id}`,
    contentType: attachment.contentType ?? null,
    sizeBytes: attachment.size ?? null,
    contentBuffer: Buffer.from(attachment.contentBytes, "base64"),
  };
}
