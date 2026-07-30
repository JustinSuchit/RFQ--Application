import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    const organization = await getCurrentOrganization();
    redirect(organization ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthPanel
      eyebrow="Create account"
      title="Register"
      description="Create your user account, then set up your organization workspace."
      footerText="Already have an account?"
      footerLabel="Log in"
      footerHref="/login"
    >
      <RegisterForm />
    </AuthPanel>
  );
}
