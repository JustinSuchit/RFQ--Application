"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { extractRfqItemsFromNotes } from "@/lib/rfqs/notes-item-extractor";
import { selectRfqExtractionSource } from "@/lib/rfqs/rfq-extraction-source";
import { RFQ_STATUS_VALUES } from "@/lib/rfqs/status";

export type UpdateRfqStatusState = {
  error: string;
};

export type ExtractRfqItemsState = {
  error: string;
  success: string;
  diagnostics?: {
    sourceUsed: string;
    sourceCharacterCount: number;
    lineCount: number;
    verticalHeaderDetected: boolean;
    verticalCandidateCount: number;
    forwardedSectionDetected: boolean;
    tableHeaderDetected: boolean;
    tableFormat: string | null;
    flattenedCandidateCount: number;
    flattenedUnitQuantityPairCount: number;
    flattenedAcceptedCount: number;
    flattenedRejected: Array<{
      description: string;
      unit: string | null;
      quantity: number | null;
      reason: string;
    }>;
    finalCandidateCount: number;
    oldGeneratedRowsReplaced: number;
    parser: string;
    ollamaMode: string | null;
  };
};

export type DeleteRfqState = {
  error: string;
};

function itemKey(item: { description: string; quantity: number | null; unit: string | null }) {
  return `${item.description.trim().toLowerCase()}|${Number(item.quantity ?? 0)}|${String(
    item.unit ?? "",
  )
    .trim()
    .toLowerCase()}`;
}

async function cleanupFailedNoteExtractionArtifacts({
  supabase,
  organizationId,
  rfqId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  rfqId: string;
}) {
  const failedDescriptions = [
    "Specification Sheet",
    "Specification Sheets",
    "specification sheet",
    "specification sheets",
    "Attachment",
    "Attachments",
    "attachment",
    "attachments",
  ];
  const { error } = await supabase
    .from("rfq_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("rfq_id", rfqId)
    .eq("notes", "Extracted from RFQ notes")
    .eq("quantity", 1)
    .eq("unit", "each")
    .in("description", failedDescriptions);

  if (error) {
    console.warn("Failed note extraction cleanup skipped", error.message);
  }
}

export async function updateRfqStatusAction(
  _previousState: UpdateRfqStatusState,
  formData: FormData,
): Promise<UpdateRfqStatusState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");
  const newStatus = String(formData.get("status") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  if (!RFQ_STATUS_VALUES.has(newStatus)) {
    return { error: "Invalid RFQ status." };
  }

  const { data: existingRfq, error: existingRfqError } = await supabase
    .from("rfqs")
    .select("id, status")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (existingRfqError || !existingRfq) {
    return {
      error:
        existingRfqError?.message ??
        "RFQ was not found or you do not have access.",
    };
  }

  if (existingRfq.status === newStatus) {
    return { error: "" };
  }

  const { error: updateError } = await supabase
    .from("rfqs")
    .update({ status: newStatus })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "RFQ status updated",
    details: {
      old_status: existingRfq.status,
      new_status: newStatus,
    },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");

  return { error: "" };
}

export async function extractRfqItemsFromNotesAction(
  _previousState: ExtractRfqItemsState,
  formData: FormData,
): Promise<ExtractRfqItemsState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required.", success: "" };
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, subject, notes")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (rfqError || !rfq) {
    return {
      error: rfqError?.message ?? "RFQ was not found.",
      success: "",
    };
  }

  const { data: linkedEmails, error: linkedEmailsError } = await supabase
    .from("email_messages")
    .select("id, body_text, body_html, body_preview, received_at")
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id)
    .order("received_at", { ascending: true });

  if (linkedEmailsError) {
    return { error: linkedEmailsError.message, success: "" };
  }

  const source = selectRfqExtractionSource({
    linkedEmails: linkedEmails ?? [],
    rfqNotes: rfq.notes,
  });

  const extraction = await extractRfqItemsFromNotes({
    subject: rfq.subject,
    notes: source.sourceText,
  });
  const extractedItems = extraction.items;
  const diagnostics = {
    sourceUsed: source.sourceUsed,
    sourceCharacterCount: source.sourceCharacterCount,
    lineCount: source.lineCount,
    verticalHeaderDetected: extraction.diagnostics.verticalTableDetected,
    verticalCandidateCount: extraction.diagnostics.verticalCandidateCount,
    forwardedSectionDetected: extraction.diagnostics.forwardedSectionDetected,
    tableHeaderDetected: extraction.diagnostics.tableHeaderDetected,
    tableFormat: extraction.diagnostics.tableFormat,
    flattenedCandidateCount: extraction.diagnostics.flattenedCandidateCount,
    flattenedUnitQuantityPairCount: extraction.diagnostics.flattenedUnitQuantityPairCount,
    flattenedAcceptedCount: extraction.diagnostics.flattenedAcceptedCount,
    flattenedRejected: extraction.diagnostics.flattenedRejected,
    finalCandidateCount: extraction.diagnostics.finalItemCount,
    oldGeneratedRowsReplaced: 0,
    parser: extraction.diagnostics.parser,
    ollamaMode: extraction.diagnostics.ollamaMode,
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("RFQ notes item extraction diagnostics", diagnostics);
  }

  if (extractedItems.length === 0) {
    return {
      error: "",
      success: extraction.diagnostics.verticalTableDetected
        ? "An item table was detected, but some rows could not be parsed. Review the original email."
        : "No reliable requested items could be extracted from these notes.",
      diagnostics,
    };
  }

  const { data: generatedRows, error: generatedRowsError } = await supabase
    .from("rfq_items")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id)
    .eq("notes", "Extracted from RFQ notes");

  if (generatedRowsError) {
    return { error: generatedRowsError.message, success: "", diagnostics };
  }

  diagnostics.oldGeneratedRowsReplaced = generatedRows?.length ?? 0;

  const { error: generatedDeleteError } = await supabase
    .from("rfq_items")
    .delete()
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id)
    .eq("notes", "Extracted from RFQ notes");

  if (generatedDeleteError) {
    return { error: generatedDeleteError.message, success: "", diagnostics };
  }

  await cleanupFailedNoteExtractionArtifacts({
    supabase,
    organizationId: organization.id,
    rfqId: rfq.id,
  });

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("rfq_items")
    .select("description, quantity, unit")
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id);

  if (existingItemsError) {
    return { error: existingItemsError.message, success: "", diagnostics };
  }

  const existingKeys = new Set(
    (existingItems ?? []).map((item) =>
      itemKey({
        description: String(item.description ?? ""),
        quantity: Number(item.quantity ?? 0),
        unit: item.unit as string | null,
      }),
    ),
  );
  const newItems = extractedItems.filter((item) => {
    const key = itemKey(item);
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (newItems.length === 0) {
    return {
      error: "",
      success: "No new requested items were extracted from these notes.",
      diagnostics,
    };
  }

  const { error: itemInsertError } = await supabase.from("rfq_items").insert(
    newItems.map((item) => ({
      organization_id: organization.id,
      rfq_id: rfq.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      required_date: null,
      notes: "Extracted from RFQ notes",
    })),
  );

  if (itemInsertError) {
    return { error: itemInsertError.message, success: "", diagnostics };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfq.id,
    user_id: user.id,
    action: "RFQ items extracted from notes",
    details: {
      extracted_item_count: newItems.length,
      parser_item_count: extraction.diagnostics.parserItemCount,
      natural_language_item_count: extraction.diagnostics.naturalLanguageItemCount,
      ollama_mode: extraction.diagnostics.ollamaMode,
      ollama_status: extraction.diagnostics.ollamaStatus,
      ollama_item_count: extraction.diagnostics.ollamaItemCount,
      final_item_count: extraction.diagnostics.finalItemCount,
      forwarded_section_detected: extraction.diagnostics.forwardedSectionDetected,
      table_format: extraction.diagnostics.tableFormat,
      table_header_detected: extraction.diagnostics.tableHeaderDetected,
      flattened_unit_quantity_pair_count: extraction.diagnostics.flattenedUnitQuantityPairCount,
      flattened_accepted_count: extraction.diagnostics.flattenedAcceptedCount,
      flattened_rejected: extraction.diagnostics.flattenedRejected,
      old_generated_rows_replaced: diagnostics.oldGeneratedRowsReplaced,
    },
  });

  if (activityError) {
    return { error: activityError.message, success: "", diagnostics };
  }

  revalidatePath(`/rfqs/${rfq.id}`);

  return {
    error: "",
    success: source.sourceUsed.startsWith("email_")
      ? `Extracted ${newItems.length} requested item${newItems.length === 1 ? "" : "s"} from the original email.`
      : extraction.diagnostics.verticalTableDetected
        ? `Extracted ${newItems.length} requested item${newItems.length === 1 ? "" : "s"} from the email table.`
      : `Extracted ${newItems.length} requested item${newItems.length === 1 ? "" : "s"} from RFQ notes.`,
    diagnostics,
  };
}

export async function deleteRfqAction(
  _previousState: DeleteRfqState,
  formData: FormData,
): Promise<DeleteRfqState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  // TODO: Tighten this to owner/admin/manager once centralized role permissions exist.
  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, rfq_number, source")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqError || !rfq) {
    return { error: rfqError?.message ?? "RFQ was not found." };
  }

  const { error: emailUpdateError } = await supabase
    .from("email_messages")
    .update({ rfq_id: null, is_rfq: null })
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id);

  if (emailUpdateError) {
    return { error: emailUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    user_id: user.id,
    action: "RFQ deleted",
    details: {
      rfq_id: rfq.id,
      rfq_number: rfq.rfq_number,
      source: rfq.source,
    },
  });

  if (activityError) {
    console.warn("Activity log insert failed", activityError.message);
  }

  const { error: deleteError } = await supabase
    .from("rfqs")
    .delete()
    .eq("id", rfq.id)
    .eq("organization_id", organization.id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/rfqs");
  revalidatePath("/dashboard");
  revalidatePath("/email-intake");
  redirect("/rfqs");
}
