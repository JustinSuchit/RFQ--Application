"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export type CreateRfqState = {
  error: string;
};

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return {
    year,
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year + 1}-01-01T00:00:00.000Z`,
  };
}

export async function createRfqAction(
  _previousState: CreateRfqState,
  formData: FormData,
): Promise<CreateRfqState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const customerCompanyName = requiredString(formData.get("customerCompanyName"));
  const contactName = optionalString(formData.get("contactName"));
  const contactEmail = requiredString(formData.get("contactEmail"));
  const contactPhone = optionalString(formData.get("contactPhone"));
  const subject = requiredString(formData.get("subject"));
  const source = optionalString(formData.get("source"));
  const priority = requiredString(formData.get("priority")) || "normal";
  const submissionDeadline = optionalString(formData.get("submissionDeadline"));
  const deliveryLocation = optionalString(formData.get("deliveryLocation"));
  const notes = optionalString(formData.get("notes"));
  const itemDescriptions = formData
    .getAll("itemDescription")
    .map((value) => String(value).trim());
  const itemQuantities = formData.getAll("itemQuantity");
  const itemUnits = formData.getAll("itemUnit");
  const itemRequiredDates = formData.getAll("itemRequiredDate");
  const itemNotes = formData.getAll("itemNotes");

  if (!customerCompanyName) {
    return { error: "Customer company name is required." };
  }

  if (!contactEmail) {
    return { error: "Contact email is required." };
  }

  if (!subject) {
    return { error: "RFQ subject is required." };
  }

  const items = itemDescriptions
    .map((description, index) => ({
      description,
      quantity: Number(itemQuantities[index] || 0),
      unit: optionalString(itemUnits[index] ?? null),
      required_date: optionalString(itemRequiredDates[index] ?? null),
      notes: optionalString(itemNotes[index] ?? null),
    }))
    .filter((item) => item.description.length > 0);

  if (items.length === 0) {
    return { error: "Add at least one RFQ item description." };
  }

  if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return { error: "Each RFQ item quantity must be greater than zero." };
  }

  const { data: existingCustomers, error: customerLookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("company_name", customerCompanyName)
    .eq("email", contactEmail)
    .limit(1);

  if (customerLookupError) {
    return { error: customerLookupError.message };
  }

  let customerId = existingCustomers?.[0]?.id as string | undefined;

  if (!customerId) {
    const { data: customer, error: customerInsertError } = await supabase
      .from("customers")
      .insert({
        organization_id: organization.id,
        company_name: customerCompanyName,
        contact_name: contactName,
        email: contactEmail,
        phone: contactPhone,
      })
      .select("id")
      .single();

    if (customerInsertError || !customer) {
      return {
        error:
          customerInsertError?.message ??
          "Unable to create the customer record.",
      };
    }

    customerId = customer.id;
  }

  const { year, start, end } = currentYearRange();
  const { count, error: countError } = await supabase
    .from("rfqs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .gte("created_at", start)
    .lt("created_at", end);

  if (countError) {
    return { error: countError.message };
  }

  const rfqNumber = `RFQ-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;

  const { data: rfq, error: rfqInsertError } = await supabase
    .from("rfqs")
    .insert({
      organization_id: organization.id,
      customer_id: customerId,
      rfq_number: rfqNumber,
      subject,
      source,
      priority,
      status: "draft",
      submission_deadline: submissionDeadline,
      delivery_location: deliveryLocation,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (rfqInsertError || !rfq) {
    return {
      error: rfqInsertError?.message ?? "Unable to create the RFQ record.",
    };
  }

  const { error: itemInsertError } = await supabase.from("rfq_items").insert(
    items.map((item) => ({
      organization_id: organization.id,
      rfq_id: rfq.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      required_date: item.required_date,
      notes: item.notes,
    })),
  );

  if (itemInsertError) {
    return { error: itemInsertError.message };
  }

  const { error: activityInsertError } = await supabase
    .from("activity_logs")
    .insert({
      organization_id: organization.id,
      rfq_id: rfq.id,
      user_id: user.id,
      action: "RFQ created",
      details: {
        rfq_number: rfqNumber,
        subject,
      },
    });

  if (activityInsertError) {
    return { error: activityInsertError.message };
  }

  redirect("/rfqs");
}
