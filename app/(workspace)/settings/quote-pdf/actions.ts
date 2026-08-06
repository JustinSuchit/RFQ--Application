"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type QuotePdfSettingsState = {
  error: string;
  success?: string;
};

const manageRoles = new Set(["owner", "admin", "manager"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function safeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#0f766e";
}

function safeFileName(value: string) {
  return value.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").toLowerCase();
}

export async function updateQuotePdfSettingsAction(
  _previousState: QuotePdfSettingsState,
  formData: FormData,
): Promise<QuotePdfSettingsState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  if (!manageRoles.has(organization.role)) {
    return { error: "Only admins and managers can update quote PDF settings." };
  }

  const validityDays = Number(text(formData, "quote_pdf_default_validity_days") || 30);
  const template = text(formData, "quote_pdf_template") === "compact" ? "compact" : "professional";
  const pageSize = text(formData, "quote_pdf_page_size") === "Letter" ? "Letter" : "A4";
  const currencyPosition = text(formData, "quote_pdf_currency_position") === "suffix" ? "suffix" : "prefix";
  const supabase = await createClient();
  const logo = formData.get("quote_pdf_logo");
  let logoPath = optionalText(formData, "existing_quote_pdf_logo_path");

  if (logo instanceof File && logo.size > 0) {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(logo.type)) {
      return { error: "Logo must be a PNG, JPG, or WebP image." };
    }
    if (logo.size > 2 * 1024 * 1024) {
      return { error: "Logo file must be 2 MB or smaller." };
    }

    const extension =
      logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const path = `organizations/${organization.id}/quote-pdf/logo-${crypto.randomUUID()}-${safeFileName(logo.name || "logo")}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("quote-pdf-assets")
      .upload(path, logo, {
        contentType: logo.type,
        upsert: false,
      });

    if (uploadError) return { error: uploadError.message };
    logoPath = path;
  }

  const settings = {
    organization_id: organization.id,
    quote_pdf_company_name: optionalText(formData, "quote_pdf_company_name"),
    quote_pdf_address: optionalText(formData, "quote_pdf_address"),
    quote_pdf_phone: optionalText(formData, "quote_pdf_phone"),
    quote_pdf_email: optionalText(formData, "quote_pdf_email"),
    quote_pdf_website: optionalText(formData, "quote_pdf_website"),
    quote_pdf_logo_path: logoPath,
    quote_pdf_accent_color: safeColor(text(formData, "quote_pdf_accent_color")),
    quote_pdf_footer_text: optionalText(formData, "quote_pdf_footer_text"),
    quote_pdf_terms: optionalText(formData, "quote_pdf_terms"),
    quote_pdf_show_taxable_subtotal: checked(formData, "quote_pdf_show_taxable_subtotal"),
    quote_pdf_show_discount: checked(formData, "quote_pdf_show_discount"),
    quote_pdf_show_delivery: checked(formData, "quote_pdf_show_delivery"),
    quote_pdf_show_item_numbers: checked(formData, "quote_pdf_show_item_numbers"),
    quote_pdf_show_quote_status: checked(formData, "quote_pdf_show_quote_status"),
    quote_pdf_show_approval_status: checked(formData, "quote_pdf_show_approval_status"),
    quote_pdf_show_notes: checked(formData, "quote_pdf_show_notes"),
    quote_pdf_default_validity_days: Number.isFinite(validityDays)
      ? Math.min(365, Math.max(1, validityDays))
      : 30,
    quote_pdf_currency_position: currencyPosition,
    quote_pdf_page_size: pageSize,
    quote_pdf_template: template,
  };

  const { error } = await supabase
    .from("organization_settings")
    .upsert(settings, { onConflict: "organization_id" });

  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    user_id: user.id,
    action: "PDF settings updated",
    details: {
      quote_pdf_template: template,
      quote_pdf_page_size: pageSize,
    },
  });

  revalidatePath("/settings/quote-pdf");
  return { error: "", success: "Quote PDF settings saved." };
}
