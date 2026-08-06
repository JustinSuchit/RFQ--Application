"use client";

import { useState } from "react";

export type OriginalEmailView = {
  id: string;
  label: string;
  subject: string;
  fromName: string | null;
  fromEmail: string;
  receivedAt: string;
  provider: string;
  body: string;
  bodyNote: string | null;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function EmailBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > 1800;
  const visibleBody = isLong && !expanded ? `${body.slice(0, 1800).trim()}...` : body;

  return (
    <div className="space-y-3">
      <div className="max-h-[38rem] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">
          {visibleBody}
        </pre>
      </div>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          {expanded ? "Collapse email" : "Show full email"}
        </button>
      ) : null}
    </div>
  );
}

function emailDetails(email: OriginalEmailView) {
  const from = email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail;

  return [
    `Subject: ${email.subject}`,
    `From: ${from}`,
    `Received: ${email.receivedAt}`,
    `Source: ${email.provider}`,
    "",
    email.body,
  ].join("\n");
}

export function OriginalEmailSection({ emails }: { emails: OriginalEmailView[] }) {
  if (emails.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-slate-600">
        No original email is linked to this RFQ.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {emails.map((email) => {
        const from = email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail;

        return (
          <section key={email.id} className="space-y-5 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {email.label}
                </p>
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-950">Subject:</span>{" "}
                    {email.subject}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">From:</span>{" "}
                    {from}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Received:</span>{" "}
                    {email.receivedAt}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Source:</span>{" "}
                    {email.provider}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={email.subject} label="Copy subject" />
                <CopyButton value={email.fromEmail} label="Copy sender email" />
                <CopyButton value={email.body} label="Copy full email body" />
                <CopyButton value={emailDetails(email)} label="Copy all email details" />
                <a
                  href={`/email-intake/${email.id}`}
                  className="inline-flex h-8 items-center rounded-md bg-slate-950 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Open in Email Intake
                </a>
              </div>
            </div>

            {email.bodyNote ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {email.bodyNote}
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Email body
              </p>
              <EmailBody body={email.body} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
