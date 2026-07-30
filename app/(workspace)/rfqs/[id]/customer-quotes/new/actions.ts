"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type CustomerQuoteState = {
  error: string;
};

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return {
    year,
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year + 1}-01-01T00:00:00.000Z`,
  };
}

type SupplierQuoteItemRow = {
  id: string;
  rfq_item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
};

type ApprovalRuleRow = {
  id: string;
  name: string;
  rule_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
};

function ruleIsTriggered(rule: ApprovalRuleRow, total: number) {
  if (rule.rule_type !== "quote_total" || rule.condition_field !== "total") {
    return false;
  }

  const conditionValue = Number(rule.condition_value);

  if (!Number.isFinite(conditionValue)) {
    return false;
  }

  if (rule.condition_operator === "greater_than") {
    return total > conditionValue;
  }

  if (rule.condition_operator === "greater_than_or_equal") {
    return total >= conditionValue;
  }

  return false;
}

export async function createCustomerQuoteAction(
  _previousState: CustomerQuoteState,
  formData: FormData,
): Promise<CustomerQuoteState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = requiredString(formData.get("rfqId"));
  const validUntil = optionalString(formData.get("validUntil"));
  const markupPercentage = numberValue(formData.get("markupPercentage"));
  const quoteDiscount = numberValue(formData.get("discount"));
  const deliveryFee = numberValue(formData.get("deliveryFee"));
  const quoteTax = numberValue(formData.get("tax"));
  const notes = optionalString(formData.get("notes"));
  const terms = optionalString(formData.get("terms"));
  const rfqItemIds = formData.getAll("rfqItemId").map((value) => String(value));
  const selectedSupplierQuoteItemIds = formData
    .getAll("selectedSupplierQuoteItemId")
    .map((value) => String(value));
  const itemDiscounts = formData.getAll("itemDiscount");
  const itemTaxes = formData.getAll("itemTax");
  const itemNotes = formData.getAll("itemNotes");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  if (
    selectedSupplierQuoteItemIds.length === 0 ||
    selectedSupplierQuoteItemIds.some((id) => id.length === 0)
  ) {
    return { error: "Select supplier pricing for every quote item." };
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (rfqError || !rfq) {
    return {
      error: rfqError?.message ?? "RFQ was not found or you do not have access.",
    };
  }

  const { data: selectedItems, error: selectedItemsError } = await supabase
    .from("supplier_quote_items")
    .select("id, rfq_item_id, description, quantity, unit_cost")
    .eq("organization_id", organization.id)
    .in("id", selectedSupplierQuoteItemIds);

  if (selectedItemsError || !selectedItems) {
    return {
      error:
        selectedItemsError?.message ??
        "Unable to load selected supplier pricing.",
    };
  }

  const selectedById = new Map(
    (selectedItems as SupplierQuoteItemRow[]).map((item) => [item.id, item]),
  );

  const quoteItems = rfqItemIds.map((rfqItemId, index) => {
    const selectedItemId = selectedSupplierQuoteItemIds[index];
    const supplierItem = selectedById.get(selectedItemId);
    const itemDiscount = numberValue(itemDiscounts[index]);
    const itemTax = numberValue(itemTaxes[index]);
    const quantity = Number(supplierItem?.quantity ?? 0);
    const unitCost = Number(supplierItem?.unit_cost ?? 0);
    const unitPrice = unitCost + unitCost * (markupPercentage / 100);
    const lineSubtotal = quantity * unitPrice;
    const totalPrice = Math.max(lineSubtotal - itemDiscount + itemTax, 0);

    return {
      rfq_item_id: rfqItemId,
      description: supplierItem?.description ?? "",
      quantity,
      unit_price: unitPrice,
      discount: itemDiscount,
      tax: itemTax,
      line_subtotal: lineSubtotal,
      total_price: totalPrice,
      notes: optionalString(itemNotes[index] ?? null),
    };
  });

  if (quoteItems.some((item) => !item.description || item.unit_price <= 0)) {
    return { error: "Selected supplier pricing is missing or invalid." };
  }

  const subtotal = quoteItems.reduce((sum, item) => sum + item.line_subtotal, 0);
  const total = Math.max(subtotal - quoteDiscount + deliveryFee + quoteTax, 0);

  if (total <= 0) {
    return { error: "Quote total must be greater than zero." };
  }

  const { year, start, end } = currentYearRange();
  const { count, error: countError } = await supabase
    .from("customer_quotes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .gte("created_at", start)
    .lt("created_at", end);

  if (countError) {
    return { error: countError.message };
  }

  const quoteNumber = `QT-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
  const { data: activeRules, error: approvalRulesError } = await supabase
    .from("approval_rules")
    .select(
      "id, name, rule_type, condition_field, condition_operator, condition_value",
    )
    .eq("organization_id", organization.id)
    .eq("is_active", true);

  if (approvalRulesError) {
    return { error: approvalRulesError.message };
  }

  const triggeredRules = ((activeRules ?? []) as ApprovalRuleRow[]).filter(
    (rule) => ruleIsTriggered(rule, total),
  );
  const approvalStatus =
    triggeredRules.length > 0 ? "pending" : "not_required";
  const quoteNotes = [notes, terms ? `Terms and conditions:\n${terms}` : null]
    .filter(Boolean)
    .join("\n\n");

  const { data: customerQuote, error: quoteInsertError } = await supabase
    .from("customer_quotes")
    .insert({
      organization_id: organization.id,
      rfq_id: rfqId,
      quote_number: quoteNumber,
      revision: 1,
      subtotal,
      tax: quoteTax,
      discount: quoteDiscount,
      delivery_fee: deliveryFee,
      total,
      margin_percentage: markupPercentage,
      status: "draft",
      approval_status: approvalStatus,
      valid_until: validUntil,
      notes: quoteNotes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (quoteInsertError || !customerQuote) {
    return {
      error: quoteInsertError?.message ?? "Unable to create customer quote.",
    };
  }

  const { error: itemInsertError } = await supabase
    .from("customer_quote_items")
    .insert(
      quoteItems.map((item) => ({
        organization_id: organization.id,
        customer_quote_id: customerQuote.id,
        rfq_item_id: item.rfq_item_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        tax: item.tax,
        total_price: item.total_price,
        notes: item.notes,
      })),
    );

  if (itemInsertError) {
    return { error: itemInsertError.message };
  }

  if (triggeredRules.length > 0) {
    const { error: approvalRequestError } = await supabase
      .from("approval_requests")
      .insert(
        triggeredRules.map((rule) => ({
          organization_id: organization.id,
          customer_quote_id: customerQuote.id,
          approval_rule_id: rule.id,
          requested_by: user.id,
          approver_user_id: null,
          status: "pending",
          comments: null,
          requested_at: new Date().toISOString(),
        })),
      );

    if (approvalRequestError) {
      return { error: approvalRequestError.message };
    }
  }

  const { error: statusUpdateError } = await supabase
    .from("rfqs")
    .update({ status: "awaiting_approval" })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (statusUpdateError) {
    return { error: statusUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action:
      triggeredRules.length > 0
        ? "Customer quote submitted for approval"
        : "Customer quote generated",
    details:
      triggeredRules.length > 0
        ? {
            quote_number: quoteNumber,
            total,
            triggered_rule_ids: triggeredRules.map((rule) => rule.id),
            triggered_rule_names: triggeredRules.map((rule) => rule.name),
          }
        : {
            quote_number: quoteNumber,
            total,
            approval_status: approvalStatus,
          },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");
  redirect(`/rfqs/${rfqId}`);
}
