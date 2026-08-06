import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  generateCustomerQuotePdf,
  quotePdfFilename,
  type CustomerQuotePdfInput,
} from "@/lib/quotes/customer-quote-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CustomerQuoteRow = CustomerQuotePdfInput["quote"] & {
  id: string;
  organization_id: string;
  rfq_id: string;
  pdf_settings_snapshot?: Record<string, unknown> | null;
  pdf_footer_note?: string | null;
  pdf_terms?: string | null;
  pdf_show_notes?: boolean | null;
  pdf_template?: string | null;
};

type RfqRow = CustomerQuotePdfInput["rfq"] & {
  id: string;
  organization_id: string;
};

type QuoteItemRow = CustomerQuotePdfInput["items"][number];

type OrganizationBrandingRow = {
  brand_color: string | null;
  quote_header_text: string | null;
  quote_footer_text: string | null;
};

type OrganizationPdfSettingsRow = {
  quote_pdf_company_name: string | null;
  quote_pdf_address: string | null;
  quote_pdf_phone: string | null;
  quote_pdf_email: string | null;
  quote_pdf_website: string | null;
  quote_pdf_accent_color: string | null;
  quote_pdf_footer_text: string | null;
  quote_pdf_terms: string | null;
  quote_pdf_show_taxable_subtotal: boolean | null;
  quote_pdf_show_discount: boolean | null;
  quote_pdf_show_delivery: boolean | null;
  quote_pdf_show_item_numbers: boolean | null;
  quote_pdf_show_quote_status: boolean | null;
  quote_pdf_show_approval_status: boolean | null;
  quote_pdf_show_notes: boolean | null;
  quote_pdf_currency_position: string | null;
  quote_pdf_page_size: string | null;
  quote_pdf_template: string | null;
};

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function logPdfRoute(
  quoteId: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  console.info("[customer-quote-pdf]", {
    quoteId,
    message,
    ...details,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const quoteId = id.trim();

  if (!quoteId) {
    return jsonError("Customer quote id is required.", 404);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("Not authenticated.", 401);
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return jsonError("No active organization found.", 403);
    }

    const supabase = await createClient();
    const { data: quote, error: quoteError } = await supabase
      .from("customer_quotes")
      .select(
        "id, organization_id, rfq_id, quote_number, revision, subtotal, tax_rate, tax_amount, tax, discount, delivery_fee, total, status, approval_status, valid_until, created_at, notes, pdf_settings_snapshot, pdf_footer_note, pdf_terms, pdf_show_notes, pdf_template",
      )
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteError) {
      console.error("[customer-quote-pdf] quote lookup failed", {
        quoteId,
        message: quoteError.message,
      });
      return jsonError(quoteError.message, 400);
    }

    if (!quote) {
      logPdfRoute(quoteId, "quote not found");
      return jsonError("Customer quote not found.", 404);
    }

    const customerQuote = quote as CustomerQuoteRow;
    if (customerQuote.organization_id !== organization.id) {
      logPdfRoute(quoteId, "organization mismatch", {
        found: true,
        organizationMatch: false,
      });
      return jsonError("You do not have access to this customer quote.", 403);
    }

    logPdfRoute(quoteId, "quote found", {
      found: true,
      organizationMatch: true,
    });

    const [rfqResponse, itemsResponse] = await Promise.all([
      supabase
        .from("rfqs")
        .select(
          "id, organization_id, rfq_number, subject, customers(company_name, contact_name, email, phone)",
        )
        .eq("id", customerQuote.rfq_id)
        .eq("organization_id", organization.id)
        .maybeSingle(),
      supabase
        .from("customer_quote_items")
        .select("description, quantity, unit_price, discount, total_price, notes")
        .eq("organization_id", organization.id)
        .eq("customer_quote_id", customerQuote.id)
        .order("created_at", { ascending: true }),
    ]);

    if (rfqResponse.error) {
      return jsonError(rfqResponse.error.message, 400);
    }

    if (!rfqResponse.data) {
      logPdfRoute(quoteId, "rfq access denied or missing");
      return jsonError("You do not have access to this RFQ.", 403);
    }

    if (itemsResponse.error) {
      return jsonError(itemsResponse.error.message, 400);
    }

    const [brandingResponse, settingsResponse] = await Promise.all([
      supabase
        .from("organizations")
        .select("brand_color, quote_header_text, quote_footer_text")
        .eq("id", organization.id)
        .maybeSingle<OrganizationBrandingRow>(),
      supabase
        .from("organization_settings")
        .select(
          "quote_pdf_company_name, quote_pdf_address, quote_pdf_phone, quote_pdf_email, quote_pdf_website, quote_pdf_accent_color, quote_pdf_footer_text, quote_pdf_terms, quote_pdf_show_taxable_subtotal, quote_pdf_show_discount, quote_pdf_show_delivery, quote_pdf_show_item_numbers, quote_pdf_show_quote_status, quote_pdf_show_approval_status, quote_pdf_show_notes, quote_pdf_currency_position, quote_pdf_page_size, quote_pdf_template",
        )
        .eq("organization_id", organization.id)
        .maybeSingle<OrganizationPdfSettingsRow>(),
    ]);
    const branding = brandingResponse.data;
    const settings = settingsResponse.data;
    const snapshot = customerQuote.pdf_settings_snapshot;
    const pdfSettings = snapshot ?? {
      company_name: settings?.quote_pdf_company_name,
      address: settings?.quote_pdf_address,
      phone: settings?.quote_pdf_phone,
      email: settings?.quote_pdf_email,
      website: settings?.quote_pdf_website,
      accent_color: settings?.quote_pdf_accent_color,
      footer_text: customerQuote.pdf_footer_note ?? settings?.quote_pdf_footer_text,
      terms: customerQuote.pdf_terms ?? settings?.quote_pdf_terms,
      show_taxable_subtotal: settings?.quote_pdf_show_taxable_subtotal,
      show_discount: settings?.quote_pdf_show_discount,
      show_delivery: settings?.quote_pdf_show_delivery,
      show_item_numbers: settings?.quote_pdf_show_item_numbers,
      show_quote_status: settings?.quote_pdf_show_quote_status,
      show_approval_status: settings?.quote_pdf_show_approval_status,
      show_notes: customerQuote.pdf_show_notes ?? settings?.quote_pdf_show_notes,
      currency_position: settings?.quote_pdf_currency_position,
      page_size: settings?.quote_pdf_page_size,
      template: customerQuote.pdf_template ?? settings?.quote_pdf_template,
    };

    const pdf = generateCustomerQuotePdf({
      organization: {
        name: organization.name,
        country: organization.country,
        currency: organization.currency,
        brand_color: branding?.brand_color ?? null,
        quote_header_text: branding?.quote_header_text ?? null,
        quote_footer_text: branding?.quote_footer_text ?? null,
      },
      rfq: rfqResponse.data as RfqRow,
      quote: customerQuote,
      items: (itemsResponse.data ?? []) as QuoteItemRow[],
      settings: pdfSettings,
    });
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "true";
    const filename = quotePdfFilename(customerQuote.quote_number);

    logPdfRoute(quoteId, "pdf generated", {
      itemCount: itemsResponse.data?.length ?? 0,
      disposition: download ? "attachment" : "inline",
    });

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[customer-quote-pdf] generation failed", {
      quoteId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError("Customer quote PDF generation failed.", 500);
  }
}
