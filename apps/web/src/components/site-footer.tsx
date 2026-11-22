import Link from "next/link";

const COLS: [string, [string, string][]][] = [
  ["For job seekers", [["/search", "Find opportunities"], ["/match", "What can I apply for?"], ["/assistant", "Ask about a post"], ["/applications", "My applications"]]],
  ["For departments", [["/portal", "Officer portal"], ["/account/request-officer-access", "Get officer access"]]],
  ["About", [["/privacy", "How we handle your information"], ["/sign-up", "Create an account"]]],
];

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-black/10 bg-black/[0.02] text-sm">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-lg font-extrabold"><span className="text-logo">iGov</span>Path</p>
          <p className="mt-2 max-w-xs text-muted">One place for South African government jobs and learnerships: find, understand, apply and follow every application.</p>
        </div>
        {COLS.map(([h, links]) => (
          <nav key={h} aria-label={h}>
            <p className="font-bold">{h}</p>
            <ul className="mt-3 space-y-2">
              {links.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-muted hover:text-interactive hover:underline">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-black/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-muted sm:flex-row sm:justify-between">
          <span><strong className="text-black">iGovPath</strong> by SPH.NC</span>
          <span>AI proposes, a named official approves. Always check the original advert.</span>
        </div>
      </div>
    </footer>
  );
}
