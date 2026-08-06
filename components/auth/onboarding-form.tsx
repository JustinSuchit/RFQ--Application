"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [taxRate, setTaxRate] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to create an organization.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.rpc("create_organization_workspace", {
        org_name: companyName,
        org_slug: companySlug,
        org_industry: industry || null,
        org_country: country || null,
        org_currency: currency || "TTD",
        org_timezone: timezone || "America/Port_of_Spain",
        org_tax_rate: Number(taxRate || 0),
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Organization setup is not configured. Please check Supabase settings.");
      setLoading(false);
      return;
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Company name
          <input
            type="text"
            value={companyName}
            onChange={(event) => {
              const nextName = event.target.value;
              setCompanyName(nextName);

              if (!slugEdited) {
                setCompanySlug(slugify(nextName));
              }
            }}
            required
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Company slug
          <input
            type="text"
            value={companySlug}
            onChange={(event) => {
              setSlugEdited(true);
              setCompanySlug(slugify(event.target.value));
            }}
            required
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Industry
          <input
            type="text"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Country
          <input
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Currency
          <input
            type="text"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            required
            maxLength={3}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Tax rate (%)
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            required
            className={inputClass}
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating workspace..." : "Create organization"}
      </button>
    </form>
  );
}
