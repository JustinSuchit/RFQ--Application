import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getCurrentOrganization, requireUser } from "@/lib/auth/session";

export default async function OnboardingPage() {
  await requireUser();
  const organization = await getCurrentOrganization();

  if (organization) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">
          Organization setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Create your organization
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Set up the company workspace that will own customers, suppliers, RFQs,
          quotes, approvals, and activity records.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
