import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, Label, Notice, PageTitle, Select } from "@/components/ui";
import { ClosingText } from "@/components/opportunity-bits";
import { EDUCATION, matchAll, type Education, type Profile } from "@/lib/matching";
import { PROVINCES } from "@/lib/format";
import { searchOpportunities } from "@/lib/opportunities";
import { getCurrentUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { saveProfile } from "./actions";

type SP = { education?: string; licence?: string; province?: string };

export default async function MatchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const u = await getCurrentUser();
  const [stored] = u ? await db.select().from(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id)) : [];
  const fromQuery = sp.education !== undefined;
  const profile: Profile | null = fromQuery
    ? {
        education: (EDUCATION.some((e) => e.key === sp.education) ? sp.education : null) as Education | null,
        driversLicence: sp.licence === "1",
        province: sp.province || null,
      }
    : stored
      ? { education: (stored.qualifications[0] as Education) ?? null, driversLicence: stored.licences.includes("drivers"), province: stored.province }
      : null;

  const opps = profile ? await searchOpportunities({ openOnly: true }) : [];
  const details = profile
    ? await db.select({ id: schema.opportunities.id, req: schema.opportunities.minimumRequirements }).from(schema.opportunities)
    : [];
  const reqs = new Map(details.map((d) => [d.id, d.req]));
  const results = profile
    ? matchAll(profile, opps.map((o) => ({
        id: o.id, postTitle: o.postTitle, province: o.province, location: o.location, departmentName: o.departmentName,
        closingDate: o.closingDate, minimumRequirements: reqs.get(o.id) ?? [],
      })))
    : [];
  const fits = results.filter((r) => r.fit === "looks_like_fit");
  const rest = results.filter((r) => r.fit === "may_be_missing");

  return (
    <div className="space-y-6">
      <PageTitle sub="Tell us what you have. We compare it with what each advert asks for and show our reasons.">What can I apply for?</PageTitle>
      <Card>
        <form className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem_auto] items-end" action={u ? saveProfile : "/match"}>
          <div>
            <Label htmlFor="education">Highest qualification</Label>
            <Select id="education" name="education" defaultValue={profile?.education ?? "grade12"}>
              {EDUCATION.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="province">Province</Label>
            <Select id="province" name="province" defaultValue={profile?.province ?? ""}>
              <option value="">Anywhere</option>
              {PROVINCES.filter((p) => p !== "National").map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" name="licence" value="1" defaultChecked={profile?.driversLicence ?? false} /> I have a driver&apos;s licence
          </label>
          <Button type="submit">Show matches</Button>
        </form>
        <p className="text-xs text-muted mt-3">
          {u ? "Saved to your account." : "Not saved. Sign in to keep your answers."} No ID number or other personal details are asked for.
        </p>
      </Card>

      {profile && (
        <>
          <Notice tone="info">
            This is a guide, not a decision. It does not say you will be shortlisted. Always read the original advert and ask the department if unsure.
          </Notice>
          <section>
            <h2 className="font-semibold mb-3">Looks like a fit ({fits.length})</h2>
            <div className="space-y-3">{fits.map((r) => <MatchCard key={r.id} r={r} />)}</div>
            {fits.length === 0 && <p className="text-sm text-muted">Nothing open matches all the stated minimums right now.</p>}
          </section>
          <section>
            <h2 className="font-semibold mb-3">You may be missing something ({rest.length})</h2>
            <div className="space-y-3">{rest.map((r) => <MatchCard key={r.id} r={r} />)}</div>
          </section>
        </>
      )}
    </div>
  );
}

function MatchCard({ r }: { r: ReturnType<typeof matchAll>[number] }) {
  return (
    <Card className="space-y-2" data-testid={r.fit === "looks_like_fit" ? "fit" : "missing"}>
      <Link href={`/posts/${r.id}`} className="font-semibold hover:text-brand">{displayTitle(r.postTitle)}</Link>
      <p className="text-sm text-muted">{r.departmentName}{r.location && ` · ${r.location}`} · <ClosingText date={r.closingDate} /></p>
      {r.reasons.length > 0 && <ul className="text-sm space-y-1">{r.reasons.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>}
      {r.missing.length > 0 && <ul className="text-sm space-y-1 text-warn-ink">{r.missing.map((x, i) => <li key={i}>• You may be missing: {x}</li>)}</ul>}
      {r.checks.length > 0 && <ul className="text-xs space-y-1 text-muted">{r.checks.map((x, i) => <li key={i}>Check yourself · {x}</li>)}</ul>}
      <Link className="text-sm text-brand underline" href={`/posts/${r.id}#source`}>Read the advert&apos;s own words</Link>
    </Card>
  );
}
