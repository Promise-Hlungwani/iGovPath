"use server";

import { safely, UserFacingError } from "@/lib/safe-action";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireAdmin, toActor } from "@/lib/session";

const idSchema = z.string().min(1);

async function currentRole(userId: string) {
  const [r] = await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, userId));
  if (!r) throw new Error("User has no role record");
  return r;
}

async function approveOfficerImpl(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const departmentId = z.coerce.number().int().positive().parse(formData.get("departmentId"));
  const before = await currentRole(userId);
  const after = { role: "officer" as const, status: "active" as const, departmentId, approvedBy: admin.id, approvedAt: new Date() };
  await db.update(schema.userRoles).set(after).where(eq(schema.userRoles.userId, userId));
  await logAudit({ actor: toActor(admin), action: "role.approve_officer", entity: "user", entityId: userId, before, after });
  revalidatePath("/admin/users");
}

async function rejectOfficerImpl(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const before = await currentRole(userId);
  const after = { status: "rejected" as const };
  await db.update(schema.userRoles).set(after).where(eq(schema.userRoles.userId, userId));
  await logAudit({ actor: toActor(admin), action: "role.reject_officer", entity: "user", entityId: userId, before, after });
  revalidatePath("/admin/users");
}

async function setDeactivatedImpl(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const deactivate = formData.get("deactivate") === "1";
  if (userId === admin.id) throw new Error("You cannot deactivate your own account");
  const before = await currentRole(userId);
  const after = { status: deactivate ? ("deactivated" as const) : ("active" as const) };
  await db.update(schema.userRoles).set(after).where(eq(schema.userRoles.userId, userId));
  if (deactivate) await db.delete(schema.session).where(eq(schema.session.userId, userId));
  await logAudit({
    actor: toActor(admin),
    action: deactivate ? "role.deactivate" : "role.reactivate",
    entity: "user",
    entityId: userId,
    before,
    after,
  });
  revalidatePath("/admin/users");
}

async function changeDepartmentImpl(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const departmentId = z.coerce.number().int().positive().parse(formData.get("departmentId"));
  const before = await currentRole(userId);
  await db.update(schema.userRoles).set({ departmentId }).where(eq(schema.userRoles.userId, userId));
  await logAudit({ actor: toActor(admin), action: "role.change_department", entity: "user", entityId: userId, before, after: { departmentId } });
  revalidatePath("/admin/users");
}

/** Give or remove admin rights. You can't change your own, and the last admin can't be removed. */
async function setAdminImpl(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const make = formData.get("make") === "1";
  if (userId === admin.id) throw new UserFacingError("You can't change your own admin rights.");
  const before = await currentRole(userId);
  if (!make) {
    const { and, count, ne } = await import("drizzle-orm");
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.userRoles)
      .where(and(eq(schema.userRoles.role, "admin"), eq(schema.userRoles.status, "active"), ne(schema.userRoles.userId, userId)));
    if (n === 0) throw new UserFacingError("There must always be at least one admin.");
  }
  const after = make
    ? { role: "admin" as const, status: "active" as const, approvedBy: admin.id, approvedAt: new Date() }
    : { role: before.departmentId ? ("officer" as const) : ("applicant" as const), status: "active" as const };
  await db.update(schema.userRoles).set(after).where(eq(schema.userRoles.userId, userId));
  await logAudit({ actor: toActor(admin), action: make ? "role.make_admin" : "role.remove_admin", entity: "user", entityId: userId, before, after });
  revalidatePath("/admin/users");
}

// Guarded entry points: a failure shows a message instead of crashing the app.
export async function approveOfficer(formData?: FormData) {
  return safely(() => approveOfficerImpl(formData as FormData), "/admin/users");
}

export async function rejectOfficer(formData?: FormData) {
  return safely(() => rejectOfficerImpl(formData as FormData), "/admin/users");
}

export async function setDeactivated(formData?: FormData) {
  return safely(() => setDeactivatedImpl(formData as FormData), "/admin/users");
}

export async function changeDepartment(formData?: FormData) {
  return safely(() => changeDepartmentImpl(formData as FormData), "/admin/users");
}
export async function setAdmin(formData?: FormData) {
  return safely(() => setAdminImpl(formData as FormData), "/admin/users");
}
