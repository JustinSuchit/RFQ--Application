export type NotificationType =
  | "approval"
  | "supplier_response"
  | "rfq_deadline"
  | "rfq_overdue"
  | "quote"
  | "rfq_status"
  | "email_intake"
  | "extraction"
  | "system";

export type NotificationPriority = "info" | "success" | "warning" | "critical";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  href: string;
  priority: NotificationPriority;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationDraft = {
  type: NotificationType;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  href: string;
  priority: NotificationPriority;
  dedupeKey: string;
  createdAt?: string;
};
