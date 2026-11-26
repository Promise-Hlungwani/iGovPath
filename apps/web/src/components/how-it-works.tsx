import type { ReactNode } from "react";

/** A short "how it works" strip with optional questions and answers, for pages with one small form. */
export function HowItWorks({ steps, faq = [] }: { steps: [string, string][]; faq?: [string, ReactNode][] }) {
  return (
    <section aria-labelledby="how" className="space-y-6 pt-4">
      <h2 id="how" className="text-lg font-extrabold">How it works</h2>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-2xl bg-black/[0.03] p-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-interactive text-sm font-bold text-white">{i + 1}</span>
            <p className="mt-3 font-bold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>
      {faq.length > 0 && (
        <div className="divide-y divide-black/10 rounded-2xl border border-black/10">
          {faq.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
              </summary>
              <div className="mt-2 text-sm text-muted">{a}</div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
