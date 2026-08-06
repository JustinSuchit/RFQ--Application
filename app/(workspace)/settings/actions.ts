"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export type ApprovalRuleActionState = {
  error: string;
  success: string;
};

export type SettingsActionState = {
  error: string;
  success: string;
};

const initialActionState: ApprovalRuleActionState = {
  error: "",
  success: "",
};

const initialSettingsState: SettingsActionState = {
  error: "",
  success: "",
};

const adminRoles = new Set(["owner", "admin"]);
const ruleTypes = new Set(["quote_total"]);
const conditionFields = new Set(["total"]);
const conditionOperators = new Set([
  "greater_than",
  "greater_than_or_equal",
]);
const approverRoles = new Set(["owner", "admin", "manager", "finance"]);
const resetValues = new Set(["yearly", "monthly", "never"]);
const templateTypes = new Set([
  "quote_email",
  "supplier_request",
  "approval_request",
  "quote_follow_up",
]);
const memberRoles = new Set([
  "owner",
  "admin",
  "manager",
  "sales",
  "procurement",
  "finance",
  "viewer",
]);
const integrationProviders = new Set([
  "microsoft_graph",
  "gmail",
  "stripe",
  "dynamics",
  "quickbooks",
  "xero",
  "zapier",
  "make",
  "n8n",
]);

function requireAdminRole(role: string) {
  if (!adminRoles.has(role)) {
    return "Only organization owners and admins can update settings.";
  }

  return "";
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function numeric(formData: FormData, key: string, fallback = 0) {
  const rawValue = String(formData.get(key) ?? fallback).trim().replace(/%$/, "");
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function integer(formData: FormData, key: string, fallback = 0) {
  return Math.max(0, Math.trunc(numeric(formData, key, fallback)));
}

function normalizeSlug(value: string) {
  return value.toLowerCase().trim();
}

function slugIsValid(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function logActivity(action: string, details?: Record<string, unknown>) {
  try {
    const user = await requireUser();
    const organization = await requireOrganization();
    const supabase = await createClient();
    const { error } = await supabase.from("activity_logs").insert({
      organization_id: organization.id,
      user_id: user.id,
      action,
      details: details ?? null,
    });

    if (error) {
      console.error("Activity log insert failed", error.message);
    }
  } catch (error) {
    console.error("Activity log insert failed", error);
  }
}

async function upsertOrganizationSettings(values: Record<string, unknown>) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  return supabase.from("organization_settings").upsert(
    {
      organization_id: organization.id,
      ...values,
    },
    { onConflict: "organization_id" },
  );
}

export async function updateOrganizationProfileAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const name = text(formData, "name");
  const slug = normalizeSlug(text(formData, "slug"));
  const industry = optionalText(formData, "industry");
  const country = optionalText(formData, "country");
  const timezone = text(formData, "timezone") || "UTC";

  if (!name) return { ...initialSettingsState, error: "Organization name is required." };
  if (!slug) return { ...initialSettingsState, error: "Slug is required." };
  if (!slugIsValid(slug)) {
    return {
      ...initialSettingsState,
      error: "Slug must be lowercase, URL-safe, and contain no spaces.",
    };
  }

  const supabase = await createClient();
  const updatedFields = { name, slug, industry, country, timezone };
  const { error } = await supabase
    .from("organizations")
    .update(updatedFields)
    .eq("id", organization.id);

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Organization profile updated", updatedFields);
  revalidatePath("/settings");
  return { error: "", success: "Organization profile saved." };
}

export async function updateBrandingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const values = {
    logo_url: optionalText(formData, "logoUrl"),
    brand_color: optionalText(formData, "brandColor"),
    quote_header_text: optionalText(formData, "quoteHeaderText"),
    quote_footer_text: optionalText(formData, "quoteFooterText"),
  };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update(values)
    .eq("id", organization.id);

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Branding settings updated", values);
  revalidatePath("/settings");
  return { error: "", success: "Branding settings saved." };
}

export async function updateCurrencyTaxAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const currency = text(formData, "currency").toUpperCase();
  const rawTaxRate = text(formData, "taxRate").replace(/%$/, "").trim();
  const taxRate = Number(rawTaxRate || 0);
  const defaultMarkupPercentage = numeric(formData, "defaultMarkupPercentage", 25);
  const defaultQuoteValidityDays = integer(formData, "defaultQuoteValidityDays", 30);

  if (!currency) return { ...initialSettingsState, error: "Currency is required." };
  if (!Number.isFinite(taxRate)) {
    return { ...initialSettingsState, error: "Tax rate must be a valid number." };
  }
  if (taxRate < 0 || taxRate > 100) {
    return { ...initialSettingsState, error: "Tax rate must be between 0% and 100%." };
  }

  const supabase = await createClient();
  const { error: orgError } = await supabase
    .from("organizations")
    .update({ currency, tax_rate: taxRate })
    .eq("id", organization.id);

  if (orgError) return { ...initialSettingsState, error: orgError.message };

  const { error: settingsError } = await upsertOrganizationSettings({
    default_markup_percentage: defaultMarkupPercentage,
    default_quote_validity_days: defaultQuoteValidityDays,
  });

  if (settingsError) return { ...initialSettingsState, error: settingsError.message };

  await logActivity("Currency and tax settings updated", {
    currency,
    tax_rate: taxRate,
    default_markup_percentage: defaultMarkupPercentage,
    default_quote_validity_days: defaultQuoteValidityDays,
  });
  revalidatePath("/settings");
  return { error: "", success: "Currency and tax settings saved." };
}

export async function updateNumberingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const rfqNumberReset = text(formData, "rfqNumberReset");
  const quoteNumberReset = text(formData, "quoteNumberReset");

  if (!resetValues.has(rfqNumberReset) || !resetValues.has(quoteNumberReset)) {
    return { ...initialSettingsState, error: "Invalid numbering reset value." };
  }

  const values = {
    rfq_prefix: text(formData, "rfqPrefix") || "RFQ",
    quote_prefix: text(formData, "quotePrefix") || "QT",
    rfq_number_padding: integer(formData, "rfqNumberPadding", 6),
    quote_number_padding: integer(formData, "quoteNumberPadding", 6),
    rfq_number_reset: rfqNumberReset,
    quote_number_reset: quoteNumberReset,
  };
  const { error } = await upsertOrganizationSettings(values);

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Numbering settings updated", values);
  revalidatePath("/settings");
  return { error: "", success: "Numbering settings saved." };
}

export async function createApprovalRuleAction(
  _previousState: ApprovalRuleActionState,
  formData: FormData,
): Promise<ApprovalRuleActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) {
    return { ...initialActionState, error: roleError };
  }

  const name = String(formData.get("name") ?? "").trim();
  const ruleType = String(formData.get("ruleType") ?? "");
  const conditionField = String(formData.get("conditionField") ?? "");
  const conditionOperator = String(formData.get("conditionOperator") ?? "");
  const conditionValue = String(formData.get("conditionValue") ?? "").trim();
  const approverRole = String(formData.get("approverRole") ?? "");
  const isActive = formData.get("isActive") === "on";

  if (!name) {
    return { ...initialActionState, error: "Rule name is required." };
  }

  if (!conditionValue) {
    return { ...initialActionState, error: "Condition value is required." };
  }

  if (Number.isNaN(Number(conditionValue))) {
    return {
      ...initialActionState,
      error: "Condition value must be a valid number.",
    };
  }

  if (
    !ruleTypes.has(ruleType) ||
    !conditionFields.has(conditionField) ||
    !conditionOperators.has(conditionOperator) ||
    !approverRoles.has(approverRole)
  ) {
    return { ...initialActionState, error: "Invalid approval rule setting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("approval_rules").insert({
    organization_id: organization.id,
    name,
    rule_type: ruleType,
    condition_field: conditionField,
    condition_operator: conditionOperator,
    condition_value: conditionValue,
    approver_role: approverRole,
    is_active: isActive,
  });

  if (error) {
    return { ...initialActionState, error: error.message };
  }

  await logActivity("Approval rule created", {
    name,
    rule_type: ruleType,
    condition_field: conditionField,
    condition_operator: conditionOperator,
    condition_value: conditionValue,
    approver_role: approverRole,
    is_active: isActive,
  });
  revalidatePath("/settings");

  return {
    error: "",
    success: "Approval rule created.",
  };
}

export async function toggleApprovalRuleAction(
  _previousState: ApprovalRuleActionState,
  formData: FormData,
): Promise<ApprovalRuleActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) {
    return { ...initialActionState, error: roleError };
  }

  const ruleId = String(formData.get("ruleId") ?? "");

  if (!ruleId) {
    return { ...initialActionState, error: "Approval rule id is required." };
  }

  const supabase = await createClient();
  const { data: existingRule, error: existingError } = await supabase
    .from("approval_rules")
    .select("id, is_active")
    .eq("id", ruleId)
    .eq("organization_id", organization.id)
    .single();

  if (existingError || !existingRule) {
    return {
      ...initialActionState,
      error:
        existingError?.message ??
        "Approval rule was not found or you do not have access.",
    };
  }

  const nextActive = !existingRule.is_active;
  const { error } = await supabase
    .from("approval_rules")
    .update({
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ...initialActionState, error: error.message };
  }

  await logActivity("Approval rule updated", {
    rule_id: ruleId,
    is_active: nextActive,
  });
  revalidatePath("/settings");

  return {
    error: "",
    success: nextActive
      ? "Approval rule activated."
      : "Approval rule deactivated.",
  };
}

export async function saveEmailTemplateAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const templateId = text(formData, "templateId");
  const templateType = text(formData, "templateType");
  const name = text(formData, "name");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const isActive = formData.get("isActive") === "on";

  if (!templateTypes.has(templateType)) {
    return { ...initialSettingsState, error: "Invalid email template type." };
  }

  if (!name || !subject || !body) {
    return {
      ...initialSettingsState,
      error: "Template name, subject, and body are required.",
    };
  }

  const supabase = await createClient();
  const payload = {
    template_type: templateType,
    name,
    subject,
    body,
    is_active: isActive,
  };
  const response = templateId
    ? await supabase
        .from("email_templates")
        .update(payload)
        .eq("id", templateId)
        .eq("organization_id", organization.id)
    : await supabase.from("email_templates").insert({
        organization_id: organization.id,
        ...payload,
      });

  if (response.error) {
    return { ...initialSettingsState, error: response.error.message };
  }

  await logActivity(
    templateId ? "Email template updated" : "Email template created",
    { template_id: templateId || null, template_type: templateType, name },
  );
  revalidatePath("/settings");
  return {
    error: "",
    success: templateId ? "Email template updated." : "Email template created.",
  };
}

export async function toggleEmailTemplateAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const templateId = text(formData, "templateId");
  const isActive = formData.get("isActive") === "true";

  if (!templateId) return { ...initialSettingsState, error: "Template id is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({ is_active: !isActive })
    .eq("id", templateId)
    .eq("organization_id", organization.id);

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Email template updated", {
    template_id: templateId,
    is_active: !isActive,
  });
  revalidatePath("/settings");
  return {
    error: "",
    success: !isActive ? "Email template activated." : "Email template deactivated.",
  };
}

export async function updateMemberRoleAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const memberId = text(formData, "memberId");
  const nextRole = text(formData, "role");

  if (!memberId) return { ...initialSettingsState, error: "Member id is required." };
  if (!memberRoles.has(nextRole)) {
    return { ...initialSettingsState, error: "Invalid member role." };
  }

  const supabase = await createClient();
  const { data: targetMember, error: targetError } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .single();

  if (targetError || !targetMember) {
    return {
      ...initialSettingsState,
      error: targetError?.message ?? "Member was not found.",
    };
  }

  if (targetMember.user_id === user.id && targetMember.role === "owner" && nextRole !== "owner") {
    const { count, error: ownerCountError } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("role", "owner")
      .eq("status", "active");

    if (ownerCountError) return { ...initialSettingsState, error: ownerCountError.message };
    if ((count ?? 0) <= 1) {
      return {
        ...initialSettingsState,
        error: "You cannot remove your own owner role as the only owner.",
      };
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("organization_id", organization.id);

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Organization member role updated", {
    member_id: memberId,
    user_id: targetMember.user_id,
    previous_role: targetMember.role,
    role: nextRole,
  });
  revalidatePath("/settings");
  return { error: "", success: "Member role updated." };
}

export async function updateIntegrationSettingAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const organization = await requireOrganization();
  const roleError = requireAdminRole(organization.role);

  if (roleError) return { ...initialSettingsState, error: roleError };

  const provider = text(formData, "provider");

  if (!integrationProviders.has(provider)) {
    return { ...initialSettingsState, error: "Invalid integration provider." };
  }

  if (provider === "microsoft_graph") {
    return {
      ...initialSettingsState,
      error: "Use the Microsoft 365 OAuth connection flow.",
    };
  }

  const supabase = await createClient();
  const payload = {
    organization_id: organization.id,
    provider,
    status: "planned",
    config: {
      note: "Connection setup coming in the next phase.",
      updated_at: new Date().toISOString(),
    },
  };
  const { error } = await supabase
    .from("integration_settings")
    .upsert(payload, { onConflict: "organization_id,provider" });

  if (error) return { ...initialSettingsState, error: error.message };

  await logActivity("Integration setting updated", {
    provider,
    status: "planned",
  });
  revalidatePath("/settings");
  return { error: "", success: "Integration placeholder saved." };
}
