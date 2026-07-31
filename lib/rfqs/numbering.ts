import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type GenerateNextRfqNumberInput = {
  supabase: SupabaseClient;
  organizationId: string;
  offset?: number;
};

function currentYear() {
  return new Date().getFullYear();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateNextRfqNumber({
  supabase,
  organizationId,
  offset = 0,
}: GenerateNextRfqNumberInput) {
  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("rfq_prefix, rfq_number_padding")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settingsError) {
    return { rfqNumber: "", error: settingsError.message };
  }

  const prefix = String(settings?.rfq_prefix || "RFQ");
  const padding = Number(settings?.rfq_number_padding || 6);
  const year = currentYear();
  const numberPrefix = `${prefix}-${year}-`;

  const { data: existingRfqs, error: rfqError } = await supabase
    .from("rfqs")
    .select("rfq_number")
    .eq("organization_id", organizationId)
    .like("rfq_number", `${numberPrefix}%`);

  if (rfqError) {
    return { rfqNumber: "", error: rfqError.message };
  }

  const suffixPattern = new RegExp(`^${escapeRegExp(numberPrefix)}(\\d+)$`);
  const highest = (existingRfqs ?? []).reduce((max, row) => {
    const match = String(row.rfq_number ?? "").match(suffixPattern);
    if (!match) return max;

    const suffix = Number(match[1]);
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 0);

  return {
    rfqNumber: `${numberPrefix}${String(highest + 1 + offset).padStart(
      padding,
      "0",
    )}`,
    error: "",
  };
}

export function isUniqueViolation(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}
