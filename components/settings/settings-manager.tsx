"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import {
  saveEmailTemplateAction,
  toggleEmailTemplateAction,
  updateBrandingAction,
  updateCurrencyTaxAction,
  updateIntegrationSettingAction,
  updateMemberRoleAction,
  updateNumberingAction,
  updateOrganizationProfileAction,
  type SettingsActionState,
} from "@/app/(workspace)/settings/actions";
import {
  ApprovalRulesManager,
  type ApprovalRule,
} from "@/components/settings/approval-rules-manager";
import { EmptyState } from "@/components/ui/empty-state";

type Organization = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  country: string | null;
  currency: string;
  timezone: string;
  tax_rate: number;
  logo_url: string | null;
  brand_color: string | null;
  quote_header_text: string | null;
  quote_footer_text: string | null;
};

type OrganizationSettings = {
  rfq_prefix: string;
  quote_prefix: string;
  rfq_number_padding: number;
  quote_number_padding: number;
  rfq_number_reset: string;
  quote_number_reset: string;
  default_quote_validity_days: number;
  default_markup_percentage: number;
};

export type EmailTemplate = {
  id: string;
  template_type: string;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
};

export type OrganizationMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  joined_at: string | null;
};

export type IntegrationSetting = {
  id: string;
  provider: string;
  status: string;
};

export type EmailConnectionSummary = {
  id: string;
  provider: string;
  mailbox_email: string | null;
  is_active: boolean | null;
};

type Props = {
  organization: Organization;
  settings: OrganizationSettings;
  approvalRules: ApprovalRule[];
  emailTemplates: EmailTemplate[];
  members: OrganizationMember[];
  integrations: IntegrationSetting[];
  microsoftConnection: EmailConnectionSummary | null;
  canManage: boolean;
  hasEmailSettings: boolean;
};

const initialState: SettingsActionState = { error: "", success: "" };
const tabs = [
  "Organization Profile",
  "Branding",
  "Currency & Tax",
  "RFQ Numbering",
  "Approval Rules",
  "Email Templates",
  "User Roles",
  "Integrations",
];

const settingGroups = [
  {
    label: "Organization",
    items: [
      { label: "Organization Profile", type: "tab" },
      { label: "Branding", type: "tab" },
      { label: "Currency & Tax", type: "tab" },
      { label: "RFQ Numbering", type: "tab" },
    ],
  },
  {
    label: "Workflow",
    items: [
      { label: "Approval Rules", type: "tab" },
      { label: "Email Templates", type: "tab" },
      { label: "User Roles", type: "tab" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Integrations", type: "tab" },
      { label: "Quote PDF", type: "link", href: "/settings/quote-pdf" },
      { label: "Scan Monitoring", type: "link", href: "/settings/email/monitoring" },
    ],
  },
] as const;

const timezoneOptions = [
  "America/Port_of_Spain",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];
const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500";
const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500";
const roleOptions = ["owner", "admin", "manager", "sales", "procurement", "finance", "viewer"];
const templateTypes = ["quote_email", "supplier_request", "approval_request", "quote_follow_up"];
const providers = [
  ["microsoft_graph", "Microsoft 365 / Outlook", "Email and Microsoft 365 workflow connections."],
  ["gmail", "Gmail", "Google mailbox and supplier communication setup."],
  ["stripe", "Stripe", "Payment and subscription workflow placeholder."],
  ["dynamics", "Microsoft Dynamics", "CRM and ERP synchronization placeholder."],
  ["quickbooks", "QuickBooks", "Accounting export placeholder."],
  ["xero", "Xero", "Accounting sync placeholder."],
  ["zapier", "Zapier", "Automation handoff placeholder."],
  ["make", "Make", "Scenario automation placeholder."],
  ["n8n", "n8n", "Workflow automation placeholder."],
];

function Message({ state }: { state: SettingsActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p className={state.error ? "text-sm font-medium text-rose-600" : "text-sm font-medium text-teal-700"}>
      {state.error || state.success}
    </p>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button disabled={pending} className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Saving..." : label}
    </button>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not joined";
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(value));
}

function FormFooter({ state, pending, canManage, label }: { state: SettingsActionState; pending: boolean; canManage: boolean; label: string }) {
  return canManage ? (
    <div className="sticky bottom-0 -mx-6 flex flex-col gap-3 border-t border-slate-200 bg-white px-6 pt-5 pb-1 sm:flex-row sm:items-center sm:justify-between lg:-mx-8 lg:px-8">
      <Submit pending={pending} label={label} />
      <Message state={state} />
    </div>
  ) : null;
}

function SettingsNavigation({
  activeTab,
  onChange,
  mobile = false,
}: {
  activeTab: string;
  onChange: (tab: string) => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <nav aria-label="Settings sections" className="lg:hidden">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {settingGroups.flatMap((group) =>
            group.items.map((item) =>
              item.type === "link" ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex h-10 shrink-0 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  aria-current={activeTab === item.label ? "page" : undefined}
                  onClick={() => onChange(item.label)}
                  className={
                    activeTab === item.label
                      ? "inline-flex h-10 shrink-0 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
                      : "inline-flex h-10 shrink-0 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  }
                >
                  {item.label}
                </button>
              ),
            ),
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Settings sections" className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-6 space-y-6 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        {settingGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) =>
                item.type === "link" ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex h-10 items-center rounded-md px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    aria-current={activeTab === item.label ? "page" : undefined}
                    onClick={() => onChange(item.label)}
                    className={
                      activeTab === item.label
                        ? "flex h-10 w-full items-center rounded-md border-l-4 border-teal-500 bg-slate-950 px-3 text-left text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
                        : "flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    }
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function SettingsManager({ organization, settings, approvalRules, emailTemplates, members, integrations, microsoftConnection, canManage, hasEmailSettings }: Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [profileState, profileAction, profilePending] = useActionState(updateOrganizationProfileAction, initialState);
  const [brandState, brandAction, brandPending] = useActionState(updateBrandingAction, initialState);
  const [currencyState, currencyAction, currencyPending] = useActionState(updateCurrencyTaxAction, initialState);
  const [numberingState, numberingAction, numberingPending] = useActionState(updateNumberingAction, initialState);
  const [templateState, templateAction, templatePending] = useActionState(saveEmailTemplateAction, initialState);
  const [rfqPrefix, setRfqPrefix] = useState(settings.rfq_prefix);
  const [quotePrefix, setQuotePrefix] = useState(settings.quote_prefix);
  const [brandColor, setBrandColor] = useState(organization.brand_color ?? "#0f766e");
  const integrationByProvider = useMemo(() => new Map(integrations.map((item) => [item.provider, item])), [integrations]);
  const timezoneValue = organization.timezone || "America/Port_of_Spain";
  const visibleTimezoneOptions = timezoneOptions.includes(timezoneValue)
    ? timezoneOptions
    : [timezoneValue, ...timezoneOptions];

  return (
    <div className="space-y-4">
      <SettingsNavigation activeTab={activeTab} onChange={setActiveTab} mobile />

      <div className="flex items-start gap-6">
        <SettingsNavigation activeTab={activeTab} onChange={setActiveTab} />

        <main className="min-w-0 flex-1">
          <div className="max-w-[1060px] rounded-md border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            {!canManage ? (
              <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Only organization owners and admins can update settings.
              </div>
            ) : null}

            {activeTab === "Organization Profile" ? (
        <Section title="Organization Profile" description="Manage the company identity and workspace defaults used across the RFQ process.">
          <form action={profileAction} className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Organization name<input name="name" required disabled={!canManage} defaultValue={organization.name} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Slug<input name="slug" required disabled={!canManage} defaultValue={organization.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Industry<input name="industry" disabled={!canManage} defaultValue={organization.industry ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Country<input name="country" disabled={!canManage} defaultValue={organization.country ?? ""} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">
              Timezone
              <select name="timezone" disabled={!canManage} defaultValue={timezoneValue} className={inputClass}>
                {visibleTimezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2"><FormFooter state={profileState} pending={profilePending} canManage={canManage} label="Save Organization Profile" /></div>
          </form>
        </Section>
      ) : null}

      {activeTab === "Branding" ? (
        <Section title="Branding" description="Control customer-facing quote presentation without making this workspace tenant-specific.">
          <form action={brandAction} className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Logo URL<input name="logoUrl" disabled={!canManage} defaultValue={organization.logo_url ?? ""} className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Brand accent color<input name="brandColor" type="color" disabled={!canManage} value={brandColor} onChange={(event) => setBrandColor(event.target.value)} className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">Quote header text<textarea name="quoteHeaderText" disabled={!canManage} defaultValue={organization.quote_header_text ?? ""} className={textareaClass} /></label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">Quote footer text<textarea name="quoteFooterText" disabled={!canManage} defaultValue={organization.quote_footer_text ?? ""} className={textareaClass} /></label>
              <div className="md:col-span-2"><FormFooter state={brandState} pending={brandPending} canManage={canManage} label="Save Branding" /></div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              {organization.logo_url ? <Image src={organization.logo_url} alt="" width={192} height={48} unoptimized className="h-12 max-w-48 object-contain" /> : <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-slate-500">Logo</div>}
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{organization.name}</h3>
              <div className="mt-4 h-2 rounded-sm" style={{ backgroundColor: brandColor }} />
              <p className="mt-4 text-sm text-slate-600">{organization.quote_footer_text || "Quote footer text preview"}</p>
            </div>
          </form>
        </Section>
      ) : null}

      {activeTab === "Currency & Tax" ? (
        <Section title="Currency & Tax" description="Set quote currency, percentage tax rate, and default commercial assumptions.">
          <form action={currencyAction} className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Currency<input name="currency" required disabled={!canManage} defaultValue={organization.currency} maxLength={3} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">
              Default tax rate (%)
              <div className="mt-2 flex h-10 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <input name="taxRate" type="number" min="0" max="100" step="0.01" disabled={!canManage} defaultValue={organization.tax_rate} className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-950 outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">%</span>
              </div>
              <span className="mt-2 block text-xs font-medium text-slate-500">
                This percentage is applied to taxable quote amounts.
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-700">Default markup percentage<input name="defaultMarkupPercentage" type="number" step="0.0001" disabled={!canManage} defaultValue={settings.default_markup_percentage} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Default quote validity days<input name="defaultQuoteValidityDays" type="number" min="0" disabled={!canManage} defaultValue={settings.default_quote_validity_days} className={inputClass} /></label>
            <div className="md:col-span-2"><FormFooter state={currencyState} pending={currencyPending} canManage={canManage} label="Save Currency & Tax" /></div>
          </form>
        </Section>
      ) : null}

      {activeTab === "RFQ Numbering" ? (
        <Section title="RFQ Numbering" description="Configure generated RFQ and quote identifiers. Counting remains yearly for this phase.">
          <form action={numberingAction} className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">RFQ prefix<input name="rfqPrefix" disabled={!canManage} value={rfqPrefix} onChange={(e) => setRfqPrefix(e.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Quote prefix<input name="quotePrefix" disabled={!canManage} value={quotePrefix} onChange={(e) => setQuotePrefix(e.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">RFQ number padding<input name="rfqNumberPadding" type="number" min="1" disabled={!canManage} defaultValue={settings.rfq_number_padding} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Quote number padding<input name="quoteNumberPadding" type="number" min="1" disabled={!canManage} defaultValue={settings.quote_number_padding} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">RFQ number reset<select name="rfqNumberReset" disabled={!canManage} defaultValue={settings.rfq_number_reset} className={inputClass}><option value="yearly">Yearly</option><option value="monthly">Monthly</option><option value="never">Never</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Quote number reset<select name="quoteNumberReset" disabled={!canManage} defaultValue={settings.quote_number_reset} className={inputClass}><option value="yearly">Yearly</option><option value="monthly">Monthly</option><option value="never">Never</option></select></label>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 md:col-span-2">Preview: {rfqPrefix || "RFQ"}-2026-000001 and {quotePrefix || "QT"}-2026-000001</div>
            <div className="md:col-span-2"><FormFooter state={numberingState} pending={numberingPending} canManage={canManage} label="Save Numbering" /></div>
          </form>
        </Section>
      ) : null}

      {activeTab === "Approval Rules" ? <Section title="Approval Rules" description="Create and activate quote approval thresholds for this organization."><ApprovalRulesManager rules={approvalRules} canManage={canManage} /></Section> : null}

      {activeTab === "Email Templates" ? (
        <Section title="Email Templates" description="Create reusable message templates with supported variables.">
          {hasEmailSettings ? <Link href="/settings/email" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">Open Email Intake Settings</Link> : null}
          <form action={templateAction} className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Template type<select name="templateType" disabled={!canManage} className={inputClass}>{templateTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Name<input name="name" required disabled={!canManage} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Subject<input name="subject" required disabled={!canManage} className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Body<textarea name="body" required disabled={!canManage} className={textareaClass} /></label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input name="isActive" type="checkbox" defaultChecked disabled={!canManage} /> Active</label>
            <p className="text-sm text-slate-600 md:col-span-2">Variables: {"{{customer_name}}, {{quote_number}}, {{rfq_number}}, {{organization_name}}, {{quote_total}}, {{valid_until}}"}</p>
            <div className="md:col-span-2"><FormFooter state={templateState} pending={templatePending} canManage={canManage} label="Create Template" /></div>
          </form>
          {emailTemplates.length ? <div className="overflow-x-auto rounded-md border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><tbody className="divide-y divide-slate-100">{emailTemplates.map((template) => <EmailTemplateRow key={template.id} template={template} canManage={canManage} />)}</tbody></table></div> : <EmptyState title="No email templates yet." /> }
        </Section>
      ) : null}

      {activeTab === "User Roles" ? (
        <Section title="User Roles" description="Review members and update their organization role.">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input placeholder="Email" disabled className={inputClass.replace("mt-2 ", "")} />
            <select disabled className={inputClass.replace("mt-2 ", "")}><option>viewer</option></select>
            <button disabled className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-500">Invite User</button>
            <p className="text-sm text-slate-600 md:col-span-3">Invitations coming soon.</p>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">User ID</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Joined</th></tr></thead><tbody className="divide-y divide-slate-100">{members.map((member) => <MemberRow key={member.id} member={member} canManage={canManage} />)}</tbody></table></div>
        </Section>
      ) : null}

            {activeTab === "Integrations" ? (
        <Section title="Integrations" description="Connect mailbox and business-system integrations for this organization.">
          {hasEmailSettings ? <Link href="/settings/email" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">Open Email Intake Settings</Link> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{providers.map(([provider, name, description]) => {
            const integration = integrationByProvider.get(provider);
            const isMicrosoft = provider === "microsoft_graph";
            const microsoftConnected = Boolean(microsoftConnection?.is_active) || integration?.status === "connected";

            return (
              <IntegrationCard
                key={provider}
                provider={provider}
                name={name}
                description={description}
                status={isMicrosoft ? (microsoftConnected ? "connected" : "not_connected") : integration?.status ?? "not_connected"}
                mailboxEmail={isMicrosoft ? microsoftConnection?.mailbox_email ?? null : null}
                canManage={canManage}
              />
            );
          })}</div>
        </Section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function EmailTemplateRow({ template, canManage }: { template: EmailTemplate; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(toggleEmailTemplateAction, initialState);
  const [editState, editAction, editPending] = useActionState(saveEmailTemplateAction, initialState);
  return <tr><td className="px-4 py-4 align-top"><p className="font-semibold text-slate-950">{template.name}</p><p className="text-xs text-slate-500">{template.template_type}</p></td><td className="px-4 py-4 align-top text-slate-600">{template.subject}</td><td className="px-4 py-4 align-top">{template.is_active ? "Active" : "Inactive"}</td><td className="px-4 py-4 align-top">{canManage ? <div className="space-y-3"><form action={formAction} className="space-y-1"><input type="hidden" name="templateId" value={template.id} /><input type="hidden" name="isActive" value={String(template.is_active)} /><button disabled={pending} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold">{pending ? "Updating..." : template.is_active ? "Deactivate" : "Activate"}</button><Message state={state} /></form><details><summary className="cursor-pointer text-xs font-semibold text-teal-700">Edit Template</summary><form action={editAction} className="mt-3 grid gap-3"><input type="hidden" name="templateId" value={template.id} /><select name="templateType" defaultValue={template.template_type} className={inputClass.replace("mt-2 ", "")}>{templateTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><input name="name" defaultValue={template.name} className={inputClass.replace("mt-2 ", "")} /><input name="subject" defaultValue={template.subject} className={inputClass.replace("mt-2 ", "")} /><textarea name="body" defaultValue={template.body} className={textareaClass} /><label className="flex items-center gap-2 text-xs font-semibold"><input name="isActive" type="checkbox" defaultChecked={template.is_active} /> Active</label><button disabled={editPending} className="h-9 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white">{editPending ? "Saving..." : "Save Template"}</button><Message state={editState} /></form></details></div> : null}</td></tr>;
}

function MemberRow({ member, canManage }: { member: OrganizationMember; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(updateMemberRoleAction, initialState);
  return <tr><td className="px-4 py-4 font-mono text-xs text-slate-700">{member.user_id}</td><td className="px-4 py-4"><form action={formAction} className="flex items-center gap-2"><input type="hidden" name="memberId" value={member.id} /><select name="role" disabled={!canManage || pending} defaultValue={member.role} className={inputClass.replace("mt-2 ", "")}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select>{canManage ? <button disabled={pending} className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold">{pending ? "Saving..." : "Save"}</button> : null}</form><Message state={state} /></td><td className="px-4 py-4 text-slate-600">{member.status}</td><td className="px-4 py-4 text-slate-600">{formatDate(member.created_at)}</td><td className="px-4 py-4 text-slate-600">{formatDate(member.joined_at)}</td></tr>;
}

function IntegrationCard({
  provider,
  name,
  description,
  status,
  mailboxEmail,
  canManage,
}: {
  provider: string;
  name: string;
  description: string;
  status: string;
  mailboxEmail?: string | null;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateIntegrationSettingAction, initialState);
  const [scanPending, setScanPending] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  async function scanMicrosoftInbox() {
    setScanPending(true);
    setScanMessage("");

    try {
      const response = await fetch("/api/integrations/microsoft/scan", {
        method: "POST",
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        scanned?: number;
        insertedOrUpdated?: number;
        likelyRfq?: number;
        possibleRfq?: number;
        skippedNotRfq?: number;
        folder?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to scan Microsoft inbox.");
      }

      setScanMessage(
        `Scanned folder ${result.folder || "inbox"}. Imported ${result.insertedOrUpdated ?? 0} RFQ-related emails. Skipped ${result.skippedNotRfq ?? 0} non-RFQ emails.`,
      );
    } catch (error) {
      setScanMessage(
        error instanceof Error ? error.message : "Unable to scan Microsoft inbox.",
      );
    } finally {
      setScanPending(false);
    }
  }

  if (provider === "microsoft_graph") {
    const connected = status === "connected";

    return (
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-950">{name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Status: {connected ? "connected" : "not connected"}</p>
        {mailboxEmail ? <p className="mt-2 text-sm text-slate-600">Mailbox: {mailboxEmail}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {canManage ? (
            <Link href="/api/integrations/microsoft/connect" className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white">
              {connected ? "Reconnect Microsoft 365" : "Connect Microsoft 365"}
            </Link>
          ) : null}
          <Link href="/settings/email" className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700">
            Email Settings
          </Link>
          {connected ? (
            <button
              type="button"
              disabled={scanPending}
              onClick={scanMicrosoftInbox}
              className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {scanPending ? "Scanning..." : "Scan Microsoft Folder"}
            </button>
          ) : null}
        </div>
        {scanMessage ? <p className="mt-3 text-sm font-medium text-slate-700">{scanMessage}</p> : null}
      </div>
    );
  }

  return <div className="rounded-md border border-slate-200 bg-white p-5"><h3 className="text-base font-semibold text-slate-950">{name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><p className="mt-4 text-xs font-semibold uppercase text-slate-500">Status: {status}</p><form action={formAction} className="mt-4 space-y-2"><input type="hidden" name="provider" value={provider} />{canManage ? <button disabled={pending} className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white">{pending ? "Saving..." : "Connect"}</button> : null}<Message state={state} /></form></div>;
}
