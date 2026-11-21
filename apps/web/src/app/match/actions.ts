"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gte, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { ai, AiServiceError, cvProfile, type CvProfile } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { todayIso } from "@/lib/opportunities";
import { requireUser, toActor } from "@/lib/session";
import { displayTitle } from "@/lib/text";

const fail = (m: string) => redirect(`/match?error=${encodeURIComponent(m)}`);

async function openPosts() {
  const rows = await db
    .select({ o: schema.opportunities, dept: schema.departments.name })
    .from(schema.opportunities)
    .innerJoin(schema.departments, eq(schema.departments.id, schema.opportunities.departmentId))
    .where(and(gte(schema.opportunities.closingDate, todayIso()), ne(schema.opportunities.status, "withdrawn")))
    .orderBy(asc(schema.opportunities.closingDate))
    .limit(60);
  return rows.map(({ o, dept }) => ({
    id: o.id, title: displayTitle(o.postTitle), department: dept, type: o.type, location: o.location, province: o.province,
    closing_date: o.closingDate, minimum_requirements: o.minimumRequirements.slice(0, 8),
  }));
}

async function computeMatches(userId: string, profile: CvProfile) {
  const r = await ai.cvMatch(profile, await openPosts(), true);
  await db.update(schema.applicantProfiles).set({ cvMatches: r.matches, matchesUpdatedAt: new Date() }).where(eq(schema.applicantProfiles.userId, userId));
}

/** Read the uploaded CV with AI and find matching posts. The file itself is never stored. */
export async function uploadCv(formData: FormData) {
  const u = await requireUser("/match");
  const file = formData.get("cv");
  if (formData.get("consent") !== "on") fail("Please tick the box to agree to your CV being read by AI.");
  if (!(file instanceof File) || file.size === 0) fail("Choose your CV file (PDF or Word).");
  const f = file as File;
  if (f.size > 4 * 1024 * 1024) fail("Your CV must be smaller than 4 MB.");
  if (!/\.(pdf|docx|txt)$/i.test(f.name)) fail("Upload your CV as a PDF or Word (.docx) file.");
  try {
    const { profile } = await cvProfile(Buffer.from(await f.arrayBuffer()), f.name, true);
    const values = {
      userId: u.id, cvProfile: profile as unknown as Record<string, unknown>, cvUpdatedAt: new Date(), cvMatches: null,
      qualifications: profile.qualifications, licences: profile.licences, languages: profile.languages, isSample: false, updatedAt: new Date(),
    };
    await db.insert(schema.applicantProfiles).values(values).onConflictDoUpdate({ target: schema.applicantProfiles.userId, set: values });
    await logAudit({ actor: toActor(u), action: "profile.update", entity: "applicant_profile", entityId: u.id, after: { cv: "read by AI" } });
    await computeMatches(u.id, profile);
  } catch (e) {
    if (e instanceof AiServiceError) fail(e.message);
    throw e;
  }
  revalidatePath("/match");
  redirect("/match");
}

export async function refreshMatches() {
  const u = await requireUser("/match");
  const [p] = await db.select().from(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id));
  if (!p?.cvProfile) redirect("/match");
  try {
    await computeMatches(u.id, p.cvProfile as unknown as CvProfile);
  } catch (e) {
    if (e instanceof AiServiceError) fail(e.message);
    throw e;
  }
  revalidatePath("/match");
  redirect("/match");
}

export async function removeCv() {
  const u = await requireUser("/match");
  await db.delete(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id));
  await logAudit({ actor: toActor(u), action: "profile.update", entity: "applicant_profile", entityId: u.id, after: { cv: "removed" } });
  revalidatePath("/match");
  redirect("/match?removed=1");
}
