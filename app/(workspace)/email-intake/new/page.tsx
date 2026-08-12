import Link from "next/link";
import { MailPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ManualEmailForm } from "@/components/email-intake/manual-email-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";

export default async function NewEmailIntakePage() {
  await requireUser();
  await requireOrganization();

  return (
    <div style={pageThemeStyle("emailIntake")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="emailIntake"
        icon={MailPlus}
        eyebrow="Manual intake"
        title="Log Email"
        description="Paste an inbound email into the workspace so it can be classified and converted into an RFQ."
      >
        <Link
          href="/email-intake"
          className="text-sm font-semibold text-[var(--page-accent)] hover:opacity-80"
        >
          Back to Email Intake
        </Link>
      </PageHeader>

      <Card className="p-6">
        <ManualEmailForm />
      </Card>
    </div>
  );
}
