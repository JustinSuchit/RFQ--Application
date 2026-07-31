import { Card } from "@/components/ui/card";
import {
  SettingsManager,
  type EmailConnectionSummary,
  type EmailTemplate,
  type IntegrationSetting,
  type OrganizationMember,
} from "@/components/settings/settings-manager";
import { type ApprovalRule } from "@/components/settings/approval-rules-manager";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

const defaultSettings = {
  rfq_prefix: "RFQ",
  quote_prefix: "QT",
  rfq_number_padding: 6,
  quote_number_padding: 6,
  rfq_number_reset: "yearly",
  quote_number_reset: "yearly",
  default_quote_validity_days: 30,
  default_markup_percentage: 25,
};

export default async function SettingsPage() {
  await requireUser();
  const currentOrganization = await requireOrganization();
  const supabase = await createClient();

  const [
    organizationResponse,
    settingsResponse,
    approvalRulesResponse,
    emailTemplatesResponse,
    membersResponse,
    integrationsResponse,
    microsoftConnectionResponse,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, slug, industry, country, currency, timezone, tax_rate, logo_url, brand_color, quote_header_text, quote_footer_text",
      )
      .eq("id", currentOrganization.id)
      .single(),
    supabase
      .from("organization_settings")
      .select(
        "rfq_prefix, quote_prefix, rfq_number_padding, quote_number_padding, rfq_number_reset, quote_number_reset, default_quote_validity_days, default_markup_percentage",
      )
      .eq("organization_id", currentOrganization.id)
      .maybeSingle(),
    supabase
      .from("approval_rules")
      .select(
        "id, name, rule_type, condition_field, condition_operator, condition_value, approver_role, is_active, created_at",
      )
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_templates")
      .select("id, template_type, name, subject, body, is_active, created_at")
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("id, user_id, role, status, created_at, joined_at")
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("integration_settings")
      .select("id, provider, status")
      .eq("organization_id", currentOrganization.id),
    supabase
      .from("email_connections")
      .select("id, provider, mailbox_email, is_active")
      .eq("organization_id", currentOrganization.id)
      .eq("provider", "microsoft_graph")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const firstError =
    organizationResponse.error ??
    settingsResponse.error ??
    approvalRulesResponse.error ??
    emailTemplatesResponse.error ??
    membersResponse.error ??
    integrationsResponse.error ??
    microsoftConnectionResponse.error;

  if (firstError || !organizationResponse.data) {
    return (
      <Card className="p-6">
        <p className="text-sm font-medium text-rose-700">
          {firstError?.message ?? "Unable to load organization settings."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">
          Tenant configuration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Settings
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Configure the organization workspace, workflow rules, user roles,
          templates, and integration settings.
        </p>
      </div>

      <Card className="p-6">
        <SettingsManager
          organization={organizationResponse.data}
          settings={{ ...defaultSettings, ...(settingsResponse.data ?? {}) }}
          approvalRules={(approvalRulesResponse.data ?? []) as ApprovalRule[]}
          emailTemplates={(emailTemplatesResponse.data ?? []) as EmailTemplate[]}
          members={(membersResponse.data ?? []) as OrganizationMember[]}
          integrations={
            (integrationsResponse.data ?? []) as IntegrationSetting[]
          }
          microsoftConnection={
            (microsoftConnectionResponse.data ?? null) as EmailConnectionSummary | null
          }
          canManage={adminRoles.has(currentOrganization.role)}
          hasEmailSettings={true}
        />
      </Card>
    </div>
  );
}
