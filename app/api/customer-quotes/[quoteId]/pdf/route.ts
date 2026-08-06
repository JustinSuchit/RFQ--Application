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
    quoteId: string;
  }>;
};

type CustomerQuoteRow = CustomerQuotePdfInput["quote"] & {
  id: string;
  rfq_id: string;
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

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteId } = await context.params;

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
        "id, rfq_id, quote_number, revision, subtotal, tax_rate, tax_amount, tax, discount, delivery_fee, total, status, approval_status, valid_until, created_at, notes",
      )
      .eq("id", quoteId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (quoteError) {
      return jsonError(quoteError.message, 400);
    }

    if (!quote) {
      return jsonError("Customer quote not found.", 404);
    }

    const customerQuote = quote as CustomerQuoteRow;
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
      return jsonError("You do not have access to this RFQ.", 403);
    }

    if (itemsResponse.error) {
      return jsonError(itemsResponse.error.message, 400);
    }

    const { data: branding } = await supabase
      .from("organizations")
      .select("brand_color, quote_header_text, quote_footer_text")
      .eq("id", organization.id)
      .maybeSingle<OrganizationBrandingRow>();

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
    });
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "true";
    const filename = quotePdfFilename(customerQuote.quote_number);

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return jsonError("Customer quote PDF generation failed.", 500);
  }
}
