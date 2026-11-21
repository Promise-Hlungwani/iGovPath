import Link from "next/link";
import { Button, Card, Input, PageTitle, Select } from "@/components/ui";
import { ClosingText, StatusBadge, TypeBadge } from "@/components/opportunity-bits";
import { PROVINCES } from "@/lib/format";
import { effectiveStatus, searchOpportunities } from "@/lib/opportunities";
import { displayTitle } from "@/lib/text";

type SP = { q?: string; province?: string; type?: string; all?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const openOnly = sp.all !== "1";
  const opportunityTypes = [
    { value: "", label: "All" },
    { value: "post", label: "Posts" },
    { value: "internship", label: "Internships" },
    { value: "learnership", label: "Learnerships" },
  ];
  const selectedType = opportunityTypes.some((type) => type.value === sp.type) ? sp.type ?? "" : "";
  const rows = await searchOpportunities({ q: sp.q, province: sp.province, type: sp.type, openOnly });

  function typeHref(type: string) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.province) params.set("province", sp.province);
    if (type) params.set("type", type);
    if (sp.all === "1") params.set("all", "1");
    const query = params.toString();
    return query ? `/search?${query}` : "/search";
  }

  return (
    <div>
      <PageTitle sub="Government posts, internships and learnerships from the Public Service Vacancy Circulars.">
        Find opportunities
      </PageTitle>
      <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] items-end mb-3" action="/search">
        <div>
          <label htmlFor="q" className="sr-only">Search</label>
          <Input id="q" name="q" defaultValue={sp.q} placeholder="Job title, department, town or reference number" />
        </div>
        <Select name="province" defaultValue={sp.province ?? ""} aria-label="Province">
          <option value="">All provinces</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p === "National" ? "National departments" : p}</option>)}
        </Select>
        <Button type="submit">Search</Button>
        {selectedType && <input type="hidden" name="type" value={selectedType} />}
        <label className="text-sm text-muted flex items-center gap-2 sm:col-span-3">
          <input type="checkbox" name="all" value="1" defaultChecked={!openOnly} /> Include closed posts
        </label>
      </form>
      <nav aria-label="Filter by opportunity type" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {opportunityTypes.map((type) => (
            <Link
              key={type.value}
              href={typeHref(type.value)}
              aria-current={selectedType === type.value ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? "border-black bg-black text-white"
                  : "border-border bg-white hover:bg-black/5"
              }`}
            >
              {type.label}
            </Link>
          ))}
        </div>
      </nav>
      <p className="text-sm text-muted mb-4">{rows.length} {rows.length === 1 ? "result" : "results"}</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="hover:border-brand transition-colors">
            <Link href={`/posts/${r.id}`} className="block">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <StatusBadge status={effectiveStatus(r.status, r.closingDate)} />
                <TypeBadge type={r.type} />
              </div>
              <h2 className="font-semibold text-lg">{displayTitle(r.postTitle)}</h2>
              <p className="text-sm text-muted">
                {r.departmentName}
                {r.location && ` · ${r.location}`}
                {r.province && r.province !== "National" && ` · ${r.province}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <ClosingText date={r.closingDate} />
                {r.referenceNumber && <span>Ref: {r.referenceNumber}</span>}
                {r.salary && <span className="text-muted">{r.salary}</span>}
              </div>
            </Link>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card><p className="text-muted">Nothing found. Try fewer words, another province, or include closed posts.</p></Card>
        )}
      </div>
    </div>
  );
}
