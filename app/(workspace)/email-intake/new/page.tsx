import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ManualEmailForm } from "@/components/email-intake/manual-email-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export default async function NewEmailIntakePage() {
  await requireUser();
  await requireOrganization();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/email-intake"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          Back to Email Intake
        </Link>
        <p className="mt-4 text-sm font-medium text-teal-700">
          Manual intake
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Log Email
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Paste an inbound email into the workspace so it can be classified and
          converted into an RFQ.
        </p>
      </div>

      <Card className="p-6">
        <ManualEmailForm />
      </Card>
    </div>
  );
}
