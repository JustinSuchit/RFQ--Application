import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  currency: string;
  timezone: string;
  tax_rate: number;
  logo_url: string | null;
  role: string;
};

type OrganizationMemberRow = {
  role: string;
  organizations:
    | {
        id: string;
        name: string;
        slug: string;
        country: string | null;
        currency: string;
        timezone: string;
        tax_rate: number;
        logo_url: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        country: string | null;
        currency: string;
        timezone: string;
        tax_rate: number;
        logo_url: string | null;
      }[]
    | null;
};

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function getUserOrganizations(): Promise<CurrentOrganization[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select(
        "role, organizations(id, name, slug, country, currency, timezone, tax_rate, logo_url)",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return (data as OrganizationMemberRow[])
      .map((membership) => {
        const organization = Array.isArray(membership.organizations)
          ? membership.organizations[0]
          : membership.organizations;

        if (!organization) {
          return null;
        }

        return {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          country: organization.country,
          currency: organization.currency,
          timezone: organization.timezone,
          tax_rate: organization.tax_rate,
          logo_url: organization.logo_url,
          role: membership.role,
        };
      })
      .filter((organization): organization is CurrentOrganization =>
        Boolean(organization),
      );
  } catch {
    return [];
  }
}

export async function getCurrentOrganization() {
  const organizations = await getUserOrganizations();
  return organizations[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireOrganization() {
  await requireUser();
  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/onboarding");
  }

  return organization;
}

export function canApproveQuote(role: string) {
  return ["owner", "admin", "manager", "finance"].includes(role);
}
