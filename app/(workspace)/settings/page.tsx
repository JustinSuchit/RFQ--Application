import { Card } from "@/components/ui/card";
import {
  ApprovalRulesManager,
  type ApprovalRule,
} from "@/components/settings/approval-rules-manager";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { settingsSections } from "@/lib/data/workspace-config";
import { createClient } from "@/lib/supabase/server";

const sectionDescriptions: Record<string, string> = {
  "Organization profile":
    "Tenant name, business details, default contacts, and operating regions.",
  Branding:
    "Logo, accent color, customer-facing labels, and document presentation.",
  "Currency and tax":
    "Default currency, tax handling, quote precision, and regional formats.",
  "RFQ numbering":
    "RFQ prefixes, annual sequences, quote numbers, and document identifiers.",
  "Approval rules":
    "Thresholds, approver groups, escalation timing, and routing policies.",
  "Email templates":
    "Supplier invitations, deadline reminders, clarifications, and awards.",
  "User roles":
    "Buyer, manager, approver, supplier-facing, and administrator permissions.",
  Integrations:
    "Placeholders for ERP, CRM, email, document storage, and notification tools.",
};

const adminRoles = new Set(["owner", "admin"]);

export default async function SettingsPage() {
  await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data: approvalRulesData, error: approvalRulesError } = await supabase
    .from("approval_rules")
    .select(
      "id, name, rule_type, condition_field, condition_operator, condition_value, approver_role, is_active, created_at",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  const approvalRules = (approvalRulesData ?? []) as ApprovalRule[];
  const canManageApprovalRules = adminRoles.has(organization.role);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">
          Tenant configuration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Settings
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Configure the organization workspace, workflow rules, user roles,
          templates, and integration settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {settingsSections.map((section) => (
          <Card key={section} className="p-5">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {section}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {sectionDescriptions[section]}
                </p>
              </div>
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-500 shadow-sm">
                {section === "Approval rules" ? "Available" : "Coming soon"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">
              Workflow controls
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Approval Rules
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Require review before high-value customer quotes can move forward.
              Rules apply only within the current organization workspace.
            </p>
          </div>
        </div>

        {approvalRulesError ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {approvalRulesError.message}
          </div>
        ) : null}

        <div className="mt-6">
          <ApprovalRulesManager
            rules={approvalRules}
            canManage={canManageApprovalRules}
          />
        </div>
      </Card>
    </div>
  );
}
