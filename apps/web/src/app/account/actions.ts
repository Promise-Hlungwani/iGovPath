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

/**
 * Permanently delete the signed-in user's account and personal data (POPIA right to deletion).
 * Removes: login + sessions, role, profile, saved posts + checklist ticks, notifications,
 * their anonymous funnel events, and audit entries about them or their personal activity.
 * Records they approved as an officer stay (department records) but no longer name them.
 */
export async function deleteMyAccount(formData: FormData) {
  const u = await requireUser("/account");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect("/account?deleteError=1");
  }
  const crypto = await import("node:crypto");
  const { env } = await import("@/lib/env");
  const { and, inArray, or } = await import("drizzle-orm");
  const funnelHash = crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(`u:${u.id}`).digest("hex").slice(0, 32);
  const PERSONAL = ["saved.add", "saved.remove", "profile.update", "user.sign_up", "role.request_officer"];

  await db.transaction(async (tx) => {
    await tx.delete(schema.funnelEvents).where(eq(schema.funnelEvents.sessionHash, funnelHash));
    // Audit entries about this person, or of their personal activity, are removed.
    await tx.delete(schema.auditLog).where(
      or(
        and(inArray(schema.auditLog.entity, ["user", "applicant_profile"]), eq(schema.auditLog.entityId, u.id)),
        and(eq(schema.auditLog.actorUserId, u.id), inArray(schema.auditLog.action, PERSONAL)),
      ),
    );
    // Officer actions on department records stay, without the person's name.
    await tx.update(schema.auditLog).set({ actorUserId: null, actorName: "Deleted user" }).where(eq(schema.auditLog.actorUserId, u.id));
    await tx.update(schema.opportunityVersions).set({ approvedBy: null }).where(eq(schema.opportunityVersions.approvedBy, u.id));
    await tx.update(schema.extractions).set({ reviewedBy: null }).where(eq(schema.extractions.reviewedBy, u.id));
    await tx.update(schema.sourceDocuments).set({ uploadedBy: null }).where(eq(schema.sourceDocuments.uploadedBy, u.id));
    await tx.update(schema.userRoles).set({ approvedBy: null }).where(eq(schema.userRoles.approvedBy, u.id));
    // Deleting the user cascades to sessions, login, role, profile, saved posts and notifications.
    await tx.delete(schema.user).where(eq(schema.user.id, u.id));
    await tx.insert(schema.auditLog).values({ actorName: "Deleted user", action: "user.delete", entity: "user", entityId: "removed" });
  });
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth")) jar.delete(c.name);
  redirect("/account-deleted");
}
