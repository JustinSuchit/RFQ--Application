import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  generateCustomerQuotePdf,
  quotePdfFilename,
  type CustomerQuotePdfInput,
} from "@/lib/quotes/customer-quote-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not authenticated.", 401);
  const organization = await getCurrentOrganization();
  if (!organization) return jsonError("No active organization found.", 403);

  const supabase = await createClient();
  const { data: quote, error: quoteError } = await supabase
    .from("customer_quotes")
    .select("id, rfq_id, quote_number, revision, subtotal, tax_rate, tax_amount, tax, discount, delivery_fee, total, status, approval_status, valid_until, created_at, notes")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quoteError) return jsonError(quoteError.message, 400);
  if (!quote) return jsonError("Create a customer quote before previewing PDF settings.", 404);

  const [rfqResponse, itemsResponse, settingsResponse, brandingResponse] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id, organization_id, rfq_number, subject, customers(company_name, contact_name, email, phone)")
      .eq("id", quote.rfq_id)
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("customer_quote_items")
      .select("description, quantity, unit_price, discount, total_price, notes")
      .eq("organization_id", organization.id)
      .eq("customer_quote_id", quote.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_settings")
      .select("quote_pdf_company_name, quote_pdf_address, quote_pdf_phone, quote_pdf_email, quote_pdf_website, quote_pdf_accent_color, quote_pdf_footer_text, quote_pdf_terms, quote_pdf_show_taxable_subtotal, quote_pdf_show_discount, quote_pdf_show_delivery, quote_pdf_show_item_numbers, quote_pdf_show_quote_status, quote_pdf_show_approval_status, quote_pdf_show_notes, quote_pdf_currency_position, quote_pdf_page_size, quote_pdf_template")
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("brand_color, quote_header_text, quote_footer_text")
      .eq("id", organization.id)
      .maybeSingle(),
  ]);

  if (rfqResponse.error) return jsonError(rfqResponse.error.message, 400);
  if (!rfqResponse.data) return jsonError("You do not have access to this RFQ.", 403);
  if (itemsResponse.error) return jsonError(itemsResponse.error.message, 400);

  const settings = settingsResponse.data;
  const pdf = generateCustomerQuotePdf({
    organization: {
      name: organization.name,
      country: organization.country,
      currency: organization.currency,
      brand_color: brandingResponse.data?.brand_color ?? null,
      quote_header_text: brandingResponse.data?.quote_header_text ?? null,
      quote_footer_text: brandingResponse.data?.quote_footer_text ?? null,
    },
    rfq: rfqResponse.data as CustomerQuotePdfInput["rfq"],
    quote: quote as CustomerQuotePdfInput["quote"],
    items: (itemsResponse.data ?? []) as CustomerQuotePdfInput["items"],
    settings: {
      company_name: settings?.quote_pdf_company_name,
      address: settings?.quote_pdf_address,
      phone: settings?.quote_pdf_phone,
      email: settings?.quote_pdf_email,
      website: settings?.quote_pdf_website,
      accent_color: settings?.quote_pdf_accent_color,
      footer_text: settings?.quote_pdf_footer_text,
      terms: settings?.quote_pdf_terms,
      show_taxable_subtotal: settings?.quote_pdf_show_taxable_subtotal,
      show_discount: settings?.quote_pdf_show_discount,
      show_delivery: settings?.quote_pdf_show_delivery,
      show_item_numbers: settings?.quote_pdf_show_item_numbers,
      show_quote_status: settings?.quote_pdf_show_quote_status,
      show_approval_status: settings?.quote_pdf_show_approval_status,
      show_notes: settings?.quote_pdf_show_notes,
      currency_position: settings?.quote_pdf_currency_position,
      page_size: settings?.quote_pdf_page_size,
      template: settings?.quote_pdf_template,
    },
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotePdfFilename(`${quote.quote_number}-preview`)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
