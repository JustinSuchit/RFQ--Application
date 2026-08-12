"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { NotificationPriority, NotificationRow, NotificationType } from "@/lib/notifications/types";

type Filter = "all" | "unread";

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

function groupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationsPageClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/notifications?limit=50&filter=${filter}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        notifications?: NotificationRow[];
        unreadCount?: number;
        error?: string;
      };

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
  }, [filter]);

  async function markRead(notificationId: string) {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notificationId }),
    });

    if (response.ok) void loadNotifications();
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });

    if (response.ok) void loadNotifications();
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadNotifications]);

  const grouped = useMemo(() => {
    const groups = new Map<string, NotificationRow[]>();

    notifications.forEach((notification) => {
      const label = groupLabel(notification.created_at);
      groups.set(label, [...(groups.get(label) ?? []), notification]);
    });

    return Array.from(groups.entries());
  }, [notifications]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--page-accent-ring)] ${
                filter === value
                  ? "border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-[var(--page-accent-hover)] hover:text-slate-950"
              }`}
            >
              {value === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={unreadCount === 0}
          onClick={markAllRead}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Mark all read
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded-md bg-slate-50" />
          ))}
        </div>
      ) : null}

      {!loading && !error && notifications.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-950">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-slate-500">No notifications match this view.</p>
        </div>
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="space-y-5">
          {grouped.map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase text-slate-500">{label}</h2>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100">
                  {items.map((notification) => {
                    const Icon = typeIcons[notification.type];
                    const unread = !notification.read_at;

                    return (
                      <Link
                        key={notification.id}
                        href={notification.href}
                        onClick={() => markRead(notification.id)}
                        className={`flex gap-3 px-4 py-4 transition hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--focus-ring)] ${
                          unread ? "bg-[var(--page-accent-soft)]" : ""
                        }`}
                      >
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${priorityClass[notification.priority]}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm ${unread ? "font-semibold text-slate-950" : "font-medium text-slate-700"}`}>
                            {notification.title}
                          </span>
                          {notification.message ? (
                            <span className="mt-1 block text-sm text-slate-600">
                              {notification.message}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-xs text-slate-500">
                            {timeLabel(notification.created_at)}
                          </span>
                        </span>
                        {unread ? (
                          <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[var(--page-accent)]" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
