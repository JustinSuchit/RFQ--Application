import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/server";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  if (!user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50);
  const unreadOnly = searchParams.get("filter") === "unread";
  const supabase = await createClient();
  const result = await listNotifications({
    supabase,
    organization,
    userId: user.id,
    limit,
    unreadOnly,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    notifications: result.notifications,
    unreadCount: result.unreadCount,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  if (!user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    notificationId?: string;
  };
  const supabase = await createClient();
  const error =
    body.action === "mark_all_read"
      ? await markAllNotificationsRead({
          supabase,
          organization,
          userId: user.id,
        })
      : body.action === "mark_read" && body.notificationId
        ? await markNotificationRead({
            supabase,
            organization,
            userId: user.id,
            notificationId: body.notificationId,
          })
        : "Invalid notification action.";

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const result = await listNotifications({
    supabase,
    organization,
    userId: user.id,
    limit: 10,
  });

  return NextResponse.json({
    notifications: result.notifications,
    unreadCount: result.unreadCount,
  });
}
