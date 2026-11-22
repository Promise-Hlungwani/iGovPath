import Link from "next/link";

/** Sign-in pages: the form, centred, beside what an account lets you do. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-15rem)] items-center gap-10 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-16">
      <div className="flex justify-center lg:justify-start">{children}</div>
      <aside className="hidden lg:block rounded-2xl bg-black/[0.03] p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">With a free account</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Apply for government jobs in one place</h2>
        <ul className="mt-6 space-y-4 text-[15px]">
          {[
            ["Apply inside iGovPath", "Your Z83 is filled in from your account and your last application."],
            ["Upload documents once", "Your CV, ID copy and qualifications are attached to every new application."],
            ["Follow every application", "See its status and get a message whenever the department updates it."],
            ["Never miss a closing date", "Save jobs and get reminders when they change or close soon."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-interactive text-[11px] font-bold text-white">✓</span>
              <span><strong className="block">{t}</strong><span className="text-muted">{d}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-8 border-t border-black/10 pt-5 text-sm text-muted">
          Work for a government department? Create an account, then ask for officer access from{" "}
          <Link className="underline" href="/account/request-officer-access">your account</Link>.
        </p>
      </aside>
    </div>
  );
}
