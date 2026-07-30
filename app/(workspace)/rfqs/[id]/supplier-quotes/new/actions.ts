"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export type SupplierQuoteState = {
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

export async function createSupplierQuoteAction(
  _previousState: SupplierQuoteState,
  formData: FormData,
): Promise<SupplierQuoteState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const rfqId = requiredString(formData.get("rfqId"));
  const supplierName = requiredString(formData.get("supplierName"));
  const supplierContactName = optionalString(formData.get("supplierContactName"));
  const supplierEmail = requiredString(formData.get("supplierEmail"));
  const supplierPhone = optionalString(formData.get("supplierPhone"));
  const supplierCategory = optionalString(formData.get("supplierCategory"));
  const currency = requiredString(formData.get("currency")) || organization.currency || "TTD";
  const quoteReference = optionalString(formData.get("quoteReference"));
  const leadTimeDays = optionalString(formData.get("leadTimeDays"));
  const validUntil = optionalString(formData.get("validUntil"));
  const freight = numberValue(formData.get("freight"));
  const tax = numberValue(formData.get("tax"));
  const status = requiredString(formData.get("status")) || "received";
  const rfqItemIds = formData.getAll("rfqItemId").map((value) => String(value));
  const descriptions = formData.getAll("description").map((value) => String(value));
  const quantities = formData.getAll("quantity");
  const unitCosts = formData.getAll("unitCost");
  const discounts = formData.getAll("discount");
  const availability = formData.getAll("availability");
  const itemNotes = formData.getAll("itemNotes");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  if (!supplierName) {
    return { error: "Supplier name is required." };
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

  const quoteItems = rfqItemIds.map((rfqItemId, index) => {
    const quantity = numberValue(quantities[index]);
    const unitCost = numberValue(unitCosts[index]);
    const discount = numberValue(discounts[index]);
    const totalCost = Math.max(quantity * unitCost - discount, 0);

    return {
      rfq_item_id: rfqItemId,
      description: descriptions[index] ?? "",
      quantity,
      unit_cost: unitCost,
      discount,
      total_cost: totalCost,
      availability: optionalString(availability[index] ?? null),
      notes: optionalString(itemNotes[index] ?? null),
    };
  });

  if (quoteItems.every((item) => item.unit_cost <= 0)) {
    return { error: "Enter at least one unit cost greater than zero." };
  }

  const subtotal = quoteItems.reduce((sum, item) => sum + item.total_cost, 0);
  const total = subtotal + freight + tax;

  const { data: existingSuppliers, error: supplierLookupError } = await supabase
    .from("suppliers")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("supplier_name", supplierName)
    .eq("email", supplierEmail)
    .limit(1);

  if (supplierLookupError) {
    return { error: supplierLookupError.message };
  }

  let supplierId = existingSuppliers?.[0]?.id as string | undefined;

  if (!supplierId) {
    const { data: supplier, error: supplierInsertError } = await supabase
      .from("suppliers")
      .insert({
        organization_id: organization.id,
        supplier_name: supplierName,
        contact_name: supplierContactName,
        email: supplierEmail || null,
        phone: supplierPhone,
        category: supplierCategory,
        currency,
      })
      .select("id")
      .single();

    if (supplierInsertError || !supplier) {
      return {
        error:
          supplierInsertError?.message ??
          "Unable to create the supplier record.",
      };
    }

    supplierId = supplier.id;
  }

  const { data: supplierQuote, error: quoteInsertError } = await supabase
    .from("supplier_quotes")
    .insert({
      organization_id: organization.id,
      rfq_id: rfqId,
      supplier_id: supplierId,
      quote_reference: quoteReference,
      currency,
      subtotal,
      tax,
      freight,
      total,
      lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
      status,
      valid_until: validUntil,
    })
    .select("id")
    .single();

  if (quoteInsertError || !supplierQuote) {
    return {
      error: quoteInsertError?.message ?? "Unable to create supplier quote.",
    };
  }

  const { error: itemInsertError } = await supabase
    .from("supplier_quote_items")
    .insert(
      quoteItems.map((item) => ({
        organization_id: organization.id,
        supplier_quote_id: supplierQuote.id,
        rfq_item_id: item.rfq_item_id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        discount: item.discount,
        total_cost: item.total_cost,
        availability: item.availability,
        notes: item.notes,
      })),
    );

  if (itemInsertError) {
    return { error: itemInsertError.message };
  }

  const { error: statusUpdateError } = await supabase
    .from("rfqs")
    .update({ status: "supplier_pricing" })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (statusUpdateError) {
    return { error: statusUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "Supplier quote added",
    details: {
      supplier_name: supplierName,
      quote_reference: quoteReference,
      subtotal,
      total,
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
