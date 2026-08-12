"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  Mail,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { NotificationPriority, NotificationRow, NotificationType } from "@/lib/notifications/types";

type NotificationResponse = {
  notifications: NotificationRow[];
  unreadCount: number;
  error?: string;
};

const typeIcons: Record<NotificationType, LucideIcon> = {
  approval: ShieldCheck,
  supplier_response: MessageSquare,
  rfq_deadline: Clock3,
  rfq_overdue: AlertTriangle,
  quote: FileText,
  rfq_status: CheckCircle2,
  email_intake: Mail,
  extraction: ScanSearch,
  system: AlertCircle,
};

const priorityClass: Record<NotificationPriority, string> = {
  info: "text-blue-700 bg-blue-50 border-blue-200",
  success: "text-emerald-700 bg-emerald-50 border-emerald-200",
  warning: "text-amber-700 bg-amber-50 border-amber-200",
  critical: "text-rose-700 bg-rose-50 border-rose-200",
};

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function unreadLabel(count: number) {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notifications?limit=10", {
        cache: "no-store",
      });
      const result = (await response.json()) as NotificationResponse;

      if (!response.ok) {
        throw new Error(result.error || "Unable to load notifications.");
      }

      setNotifications(result.notifications ?? []);
      setUnreadCount(result.unreadCount ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function postNotificationAction(action: string, notificationId?: string) {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notificationId }),
    });
    const result = (await response.json().catch(() => ({}))) as NotificationResponse;

    if (response.ok) {
      setNotifications(result.notifications ?? notifications);
      setUnreadCount(result.unreadCount ?? 0);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0);
    const interval = window.setInterval(loadNotifications, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-slate-600 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold leading-none text-white"
          >
            {unreadLabel(unreadCount)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 flex max-h-[min(560px,calc(100vh-5rem))] w-[calc(100vw-2rem)] max-w-[410px] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] sm:w-[390px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Notifications</p>
              {unreadCount > 0 ? (
                <p className="text-xs text-slate-500">{unreadCount} unread</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => postNotificationAction("mark_all_read")}
              className="text-xs font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all read
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-2">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 rounded-md bg-slate-50" />
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {!loading && !error && notifications.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]">
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-950">You&apos;re all caught up</p>
                <p className="mt-1 text-sm text-slate-500">No new notifications.</p>
              </div>
            ) : null}

            <div className="space-y-1">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type];
                const unread = !notification.read_at;

                return (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    onClick={() => {
                      void postNotificationAction("mark_read", notification.id);
                      setOpen(false);
                    }}
                    className={`flex gap-3 rounded-md px-3 py-3 transition hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
                      unread ? "bg-[var(--page-accent-soft)]" : ""
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${priorityClass[notification.priority]}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${unread ? "font-semibold text-slate-950" : "font-medium text-slate-700"}`}>
                        {notification.title}
                      </span>
                      {notification.message ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {notification.message}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-slate-400">
                        {relativeTime(notification.created_at)}
                      </span>
                    </span>
                    {unread ? (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--page-accent)]" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 p-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-center text-sm font-semibold text-[var(--primary)] hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
