/**
 * Rule-based "what can I apply for" matching. It only compares a profile with the
 * advert's stated requirements and explains the result with the advert's own words.
 * It never ranks, scores or judges a person (POPIA s71) and never says "eligible".
 */

export const EDUCATION = [
  { key: "grade10", label: "Grade 10 / ABET" },
  { key: "grade12", label: "Grade 12 (matric / National Senior Certificate / NCV 4)" },
  { key: "diploma", label: "Diploma or N6 / TVET qualification" },
  { key: "degree", label: "Bachelor's degree" },
  { key: "postgrad", label: "Honours or higher" },
] as const;
export type Education = (typeof EDUCATION)[number]["key"];
const RANK: Record<Education, number> = { grade10: 1, grade12: 2, diploma: 3, degree: 4, postgrad: 5 };

export type Profile = { education: Education | null; driversLicence: boolean; province: string | null };

export type MatchInput = {
  id: string;
  postTitle: string;
  province: string | null;
  location: string | null;
  departmentName: string;
  closingDate: string | null;
  minimumRequirements: string[];
};

export type MatchResult = MatchInput & {
  fit: "looks_like_fit" | "may_be_missing";
  reasons: string[];
  missing: string[];
  checks: string[];
};

/** Lowest qualification the advert accepts, with the requirement sentence it came from. */
export function requiredEducation(reqs: string[]): { level: Education | null; quote: string | null } {
  const text = reqs.join(" \n ");
  const lower = text.toLowerCase();
  const quote = (re: RegExp) => reqs.find((r) => re.test(r.toLowerCase())) ?? null;
  const hasDegree = /bachelor|degree|nqf\s*level\s*7|b-?tech|b\.?\s?com\b/.test(lower);
  const hasDiploma = /diploma|nqf\s*level\s*[56]\b|n6\b|national n|tvet|nated/.test(lower);
  const hasHonours = /honours|master|postgraduate|nqf\s*level\s*[89]/.test(lower);
  const hasG12 = /grade\s*12|senior certificate|matric|nqf\s*level\s*4|ncv\s*(level\s*)?4/.test(lower);
  const hasG10 = /grade\s*10|abet|nqf\s*level\s*[1-3]\b/.test(lower);
  if (hasHonours && !hasDegree) return { level: "postgrad", quote: quote(/honours|master|postgraduate|nqf\s*level\s*[89]/) };
  if (hasDiploma) return { level: "diploma", quote: quote(/diploma|nqf\s*level\s*[56]|n6|tvet/) };
  if (hasDegree) return { level: "degree", quote: quote(/bachelor|degree|nqf\s*level\s*7/) };
  if (hasG12) return { level: "grade12", quote: quote(/grade\s*12|senior certificate|matric|nqf\s*level\s*4|ncv/) };
  if (hasG10) return { level: "grade10", quote: quote(/grade\s*10|abet|nqf\s*level/) };
  return { level: null, quote: null };
}

export function requiresLicence(reqs: string[]): { required: boolean; quote: string | null } {
  const q = reqs.find((r) => /driver.?s?\s*licen[cs]e/i.test(r) && !/advantage|added advantage|recommend/i.test(r));
  return { required: !!q, quote: q ?? null };
}

const short = (s: string) => (s.length > 140 ? s.slice(0, 139) + "…" : s);

export function matchOne(p: Profile, o: MatchInput): MatchResult {
  const reasons: string[] = [];
  const missing: string[] = [];
  const checks: string[] = [];
  const edu = requiredEducation(o.minimumRequirements);
  if (edu.level && p.education) {
    if (RANK[p.education] >= RANK[edu.level]) reasons.push(`Your qualification meets the stated minimum: “${short(edu.quote!)}”`);
    else missing.push(`A higher qualification: the advert asks for “${short(edu.quote!)}”`);
  } else if (edu.level) {
    checks.push(`Qualification asked for: “${short(edu.quote!)}”`);
  } else {
    checks.push("The advert does not state a minimum qualification clearly. Read the original advert.");
  }
  const lic = requiresLicence(o.minimumRequirements);
  if (lic.required) {
    if (p.driversLicence) reasons.push("You have a driver's licence, which the advert asks for.");
    else missing.push(`A driver's licence: “${short(lic.quote!)}”`);
  }
  const exp = o.minimumRequirements.find((r) => /experience/i.test(r) && /\d|year/i.test(r));
  if (exp) checks.push(`Experience: “${short(exp)}”`);
  const reg = o.minimumRequirements.find((r) => /registration|registered with|council/i.test(r));
  if (reg) checks.push(`Registration: “${short(reg)}”`);
  return { ...o, fit: missing.length ? "may_be_missing" : "looks_like_fit", reasons, missing, checks };
}

export function matchAll(p: Profile, opps: MatchInput[]): MatchResult[] {
  const inArea = opps.filter((o) => !p.province || o.province === p.province || o.province === "National");
  const results = inArea.map((o) => matchOne(p, o));
  // Group, not rank: fits first, then the rest, each by closing date.
  return results.sort((a, b) =>
    a.fit === b.fit ? (a.closingDate ?? "9999").localeCompare(b.closingDate ?? "9999") : a.fit === "looks_like_fit" ? -1 : 1,
  );
}
