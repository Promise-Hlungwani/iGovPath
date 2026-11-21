"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireUser, toActor } from "@/lib/session";

const requestSchema = z.object({
  departmentId: z.coerce.number().int().positive(),
  jobTitle: z.string().trim().min(2).max(120),
});

/** Applicant asks for officer access. Status stays "pending" until an admin approves. */
export async function requestOfficerAccess(formData: FormData) {
  const u = await requireUser("/account/request-officer-access");
  if (u.role !== "applicant" && !(u.role === "officer" && u.status === "rejected")) {
    redirect("/account");
  }
  const parsed = requestSchema.safeParse({
    departmentId: formData.get("departmentId"),
    jobTitle: formData.get("jobTitle"),
  });
  if (!parsed.success) redirect("/account/request-officer-access?error=1");

  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.id, parsed.data.departmentId));
  if (!dept) redirect("/account/request-officer-access?error=1");

  const before = { role: u.role, status: u.status, departmentId: u.departmentId };
  const after = { role: "officer" as const, status: "pending" as const, departmentId: dept.id, jobTitle: parsed.data.jobTitle };
  await db
    .update(schema.userRoles)
    .set({ ...after, requestedAt: new Date(), approvedAt: null, approvedBy: null })
    .where(eq(schema.userRoles.userId, u.id));
  await logAudit({ actor: toActor(u), action: "role.request_officer", entity: "user", entityId: u.id, before, after });
  revalidatePath("/account");
  redirect("/account");
}
