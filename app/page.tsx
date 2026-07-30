import Link from "next/link";

const platformStats = [
  { label: "RFQ cycle visibility", value: "Live" },
  { label: "Supplier collaboration", value: "Centralized" },
  { label: "Tenant-ready workflows", value: "Built in" },
];

const features = [
  "Multi-organization workspace foundation",
  "Structured RFQ, quote, customer, and supplier areas",
  "Clean workflows for RFQ intake, pricing, and approvals",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0),rgba(15,23,42,0.92))]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-8">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-slate-950">
                RFQ
              </div>
              <span className="text-sm font-semibold tracking-wide">
                ProcureFlow
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-teal-300 hover:bg-white/10"
            >
              Open dashboard
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">
                Multi-tenant RFQ SaaS
              </p>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Run RFQs, supplier quotes, and purchasing decisions in one
                shared platform.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                A generalized SaaS foundation for companies that need a clearer
                way to request pricing, coordinate suppliers, compare quotes,
                and manage procurement workflows across teams.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-teal-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-950/30 transition hover:bg-teal-300"
                >
                  View workspace
                </Link>
                <Link
                  href="/rfqs"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  Browse RFQs
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-slate-950/60 backdrop-blur">
              <div className="rounded-md bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      RFQ workspace
                    </p>
                    <p className="text-xs text-slate-500">
                      New organization setup
                    </p>
                  </div>
                  <span className="rounded-md bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    Ready
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ["RFQ intake", "Capture request details"],
                    ["Supplier pricing", "Collect supplier responses"],
                    ["Quote review", "Compare and approve outcomes"],
                  ].map(([title, helper]) => (
                    <div
                      key={title}
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {helper}
                          </p>
                        </div>
                        <div className="h-2 w-20 rounded-full bg-slate-200">
                          <div className="h-2 w-2/3 rounded-full bg-teal-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 pb-4 md:grid-cols-3">
            {platformStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-white/10 bg-white/[0.08] p-5"
              >
                <p className="text-sm text-slate-300">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 text-slate-950 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              First setup phase
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              A professional foundation for RFQ workflows.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-6 text-slate-700"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
