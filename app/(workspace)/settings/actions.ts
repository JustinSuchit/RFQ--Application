"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/session";

export type ApprovalRuleActionState = {
  error: string;
  success: string;
};

const initialActionState: ApprovalRuleActionState = {
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

function requireAdminRole(role: string) {
  if (!adminRoles.has(role)) {
    return "Only organization admins can manage approval rules.";
  }

  return "";
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

  revalidatePath("/settings");

  return {
    error: "",
    success: nextActive
      ? "Approval rule activated."
      : "Approval rule deactivated.",
  };
}
