import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    const organization = await getCurrentOrganization();
    redirect(organization ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthPanel
      eyebrow="Welcome back"
      title="Log in"
      description="Access your RFQ workspace with your email and password."
      footerText="Need an account?"
      footerLabel="Register"
      footerHref="/register"
    >
      <LoginForm />
    </AuthPanel>
  );
}
