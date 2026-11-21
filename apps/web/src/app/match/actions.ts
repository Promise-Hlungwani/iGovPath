"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { EDUCATION } from "@/lib/matching";
import { requireUser, toActor } from "@/lib/session";

const s = z.object({
  education: z.enum(EDUCATION.map((e) => e.key) as [string, ...string[]]),
  province: z.string().max(40).optional(),
  licence: z.literal("1").optional(),
});

export async function saveProfile(formData: FormData) {
  const u = await requireUser("/match");
  const p = s.parse(Object.fromEntries(formData));
  const values = {
    userId: u.id,
    qualifications: [p.education],
    licences: p.licence ? ["drivers"] : [],
    province: p.province || null,
    isSample: true,
    updatedAt: new Date(),
  };
  await db.insert(schema.applicantProfiles).values(values).onConflictDoUpdate({ target: schema.applicantProfiles.userId, set: values });
  await logAudit({ actor: toActor(u), action: "profile.update", entity: "applicant_profile", entityId: u.id });
  redirect(`/match?education=${p.education}&province=${encodeURIComponent(p.province || "")}&licence=${p.licence ? 1 : 0}`);
}
