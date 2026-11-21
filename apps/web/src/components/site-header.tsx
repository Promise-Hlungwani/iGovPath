import Link from "next/link";

export async function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          <span className="text-brand">iGov</span>Path
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search" className="hover:text-brand">Find opportunities</Link>
        </nav>
      </div>
    </header>
  );
}
