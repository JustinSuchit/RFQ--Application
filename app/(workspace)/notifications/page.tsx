import { Bell } from "lucide-react";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { PageHeader } from "@/components/ui/page-header";
import { pageThemeStyle } from "@/lib/page-themes";

export default function NotificationsPage() {
  return (
    <div style={pageThemeStyle("dashboard")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="dashboard"
        icon={Bell}
        eyebrow="Workspace activity"
        title="Notifications"
        description="Review important procurement work, deadline alerts, approvals, supplier responses, and intake issues."
      />
      <NotificationsPageClient />
    </div>
  );
}
