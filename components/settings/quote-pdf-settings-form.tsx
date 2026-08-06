"use client";

import { useActionState } from "react";
import {
  updateQuotePdfSettingsAction,
  type QuotePdfSettingsState,
} from "@/app/(workspace)/settings/quote-pdf/actions";

export type QuotePdfSettings = {
  quote_pdf_company_name: string | null;
  quote_pdf_address: string | null;
  quote_pdf_phone: string | null;
  quote_pdf_email: string | null;
  quote_pdf_website: string | null;
  quote_pdf_logo_path: string | null;
  quote_pdf_accent_color: string | null;
  quote_pdf_footer_text: string | null;
  quote_pdf_terms: string | null;
  quote_pdf_show_taxable_subtotal: boolean;
  quote_pdf_show_discount: boolean;
  quote_pdf_show_delivery: boolean;
  quote_pdf_show_item_numbers: boolean;
  quote_pdf_show_quote_status: boolean;
  quote_pdf_show_approval_status: boolean;
  quote_pdf_show_notes: boolean;
  quote_pdf_default_validity_days: number;
  quote_pdf_currency_position: string;
  quote_pdf_page_size: string;
  quote_pdf_template: string;
};

const initialState: QuotePdfSettingsState = { error: "" };
const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: keyof QuotePdfSettings;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

export function QuotePdfSettingsForm({
  settings,
  canManage,
}: {
  settings: QuotePdfSettings;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateQuotePdfSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-8">
      <fieldset disabled={!canManage || pending} className="space-y-8 disabled:opacity-70">
        <section>
          <h2 className="text-lg font-semibold text-slate-950">Company details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Company name<input name="quote_pdf_company_name" defaultValue={settings.quote_pdf_company_name ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Phone<input name="quote_pdf_phone" defaultValue={settings.quote_pdf_phone ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Email<input name="quote_pdf_email" defaultValue={settings.quote_pdf_email ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Website<input name="quote_pdf_website" defaultValue={settings.quote_pdf_website ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Address<textarea name="quote_pdf_address" defaultValue={settings.quote_pdf_address ?? ""} className={textareaClass} /></label>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-950">Branding</h2>
          <input type="hidden" name="existing_quote_pdf_logo_path" value={settings.quote_pdf_logo_path ?? ""} />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              Logo upload
              <input name="quote_pdf_logo" type="file" accept="image/png,image/jpeg,image/webp" className={inputClass} />
              {settings.quote_pdf_logo_path ? (
                <span className="mt-1 block text-xs font-medium text-slate-500">Current logo path saved</span>
              ) : null}
            </label>
            <label className="text-sm font-semibold text-slate-700">Accent colour<input name="quote_pdf_accent_color" type="color" defaultValue={settings.quote_pdf_accent_color ?? "#0f766e"} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Template<select name="quote_pdf_template" defaultValue={settings.quote_pdf_template} className={inputClass}><option value="professional">Professional</option><option value="compact">Compact</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Page size<select name="quote_pdf_page_size" defaultValue={settings.quote_pdf_page_size} className={inputClass}><option value="A4">A4</option><option value="Letter">Letter</option></select></label>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-950">Document controls</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Default validity days<input name="quote_pdf_default_validity_days" type="number" min="1" max="365" defaultValue={settings.quote_pdf_default_validity_days} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Currency position<select name="quote_pdf_currency_position" defaultValue={settings.quote_pdf_currency_position} className={inputClass}><option value="prefix">Prefix</option><option value="suffix">Suffix</option></select></label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Toggle name="quote_pdf_show_discount" label="Show discount" defaultChecked={settings.quote_pdf_show_discount} />
            <Toggle name="quote_pdf_show_taxable_subtotal" label="Show taxable subtotal" defaultChecked={settings.quote_pdf_show_taxable_subtotal} />
            <Toggle name="quote_pdf_show_delivery" label="Show delivery" defaultChecked={settings.quote_pdf_show_delivery} />
            <Toggle name="quote_pdf_show_item_numbers" label="Show item numbers" defaultChecked={settings.quote_pdf_show_item_numbers} />
            <Toggle name="quote_pdf_show_quote_status" label="Show quote status" defaultChecked={settings.quote_pdf_show_quote_status} />
            <Toggle name="quote_pdf_show_approval_status" label="Show approval status" defaultChecked={settings.quote_pdf_show_approval_status} />
            <Toggle name="quote_pdf_show_notes" label="Show notes" defaultChecked={settings.quote_pdf_show_notes} />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-950">Footer</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Footer text<textarea name="quote_pdf_footer_text" defaultValue={settings.quote_pdf_footer_text ?? ""} className={textareaClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Terms and conditions<textarea name="quote_pdf_terms" defaultValue={settings.quote_pdf_terms ?? ""} className={textareaClass} /></label>
          </div>
        </section>
      </fieldset>
      {state.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-teal-700">{state.success}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
        <a href="/api/customer-quotes/preview/pdf" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">Preview Quote PDF</a>
        {canManage ? <button disabled={pending} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">Save PDF settings</button> : null}
      </div>
    </form>
  );
}
