import Link from "next/link";
import { FileCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  QuotePdfSettingsForm,
  type QuotePdfSettings,
} from "@/components/settings/quote-pdf-settings-form";
import { requireOrganization } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
import { createClient } from "@/lib/supabase/server";

const defaultSettings: QuotePdfSettings = {
  quote_pdf_company_name: null,
  quote_pdf_address: null,
  quote_pdf_phone: null,
  quote_pdf_email: null,
  quote_pdf_website: null,
  quote_pdf_logo_path: null,
  quote_pdf_accent_color: "#0f766e",
  quote_pdf_footer_text: null,
  quote_pdf_terms: null,
  quote_pdf_show_taxable_subtotal: true,
  quote_pdf_show_discount: true,
  quote_pdf_show_delivery: true,
  quote_pdf_show_item_numbers: true,
  quote_pdf_show_quote_status: true,
  quote_pdf_show_approval_status: true,
  quote_pdf_show_notes: false,
  quote_pdf_default_validity_days: 30,
  quote_pdf_currency_position: "prefix",
  quote_pdf_page_size: "A4",
  quote_pdf_template: "professional",
};

export default async function QuotePdfSettingsPage() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("quote_pdf_company_name, quote_pdf_address, quote_pdf_phone, quote_pdf_email, quote_pdf_website, quote_pdf_logo_path, quote_pdf_accent_color, quote_pdf_footer_text, quote_pdf_terms, quote_pdf_show_taxable_subtotal, quote_pdf_show_discount, quote_pdf_show_delivery, quote_pdf_show_item_numbers, quote_pdf_show_quote_status, quote_pdf_show_approval_status, quote_pdf_show_notes, quote_pdf_default_validity_days, quote_pdf_currency_position, quote_pdf_page_size, quote_pdf_template")
    .eq("organization_id", organization.id)
    .maybeSingle();
  const canManage = ["owner", "admin", "manager"].includes(organization.role);

  return (
    <div style={pageThemeStyle("settings")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="settings"
        icon={FileCog}
        eyebrow="Document branding"
        title="Quote PDF"
        description="Configure company details, branding, defaults, and PDF display controls for customer quotations."
      >
        <Link href="/settings" className="text-sm font-semibold text-[var(--page-accent)] hover:opacity-80">Back to settings</Link>
      </PageHeader>
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error.message}</div> : null}
      <Card className="p-6">
        <QuotePdfSettingsForm settings={{ ...defaultSettings, ...(data ?? {}) }} canManage={canManage} />
      </Card>
    </div>
  );
}
