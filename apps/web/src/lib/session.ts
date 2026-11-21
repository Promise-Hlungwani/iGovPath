import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/audit";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "applicant" | "officer" | "admin";
  status: "active" | "pending" | "rejected" | "deactivated";
  departmentId: number | null;
  departmentName: string | null;
  jobTitle: string | null;
};

/** The signed-in user with role, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [r] = await db
    .select({
      role: schema.userRoles.role,
      status: schema.userRoles.status,
      departmentId: schema.userRoles.departmentId,
      departmentName: schema.departments.name,
      jobTitle: schema.userRoles.jobTitle,
    })
    .from(schema.userRoles)
    .leftJoin(schema.departments, eq(schema.departments.id, schema.userRoles.departmentId))
    .where(eq(schema.userRoles.userId, s.user.id));
  return {
    id: s.user.id,
    name: s.user.name,
    email: s.user.email,
    role: r?.role ?? "applicant",
    status: r?.status ?? "active",
    departmentId: r?.departmentId ?? null,
    departmentName: r?.departmentName ?? null,
    jobTitle: r?.jobTitle ?? null,
  };
});

export function toActor(u: CurrentUser): NonNullable<Actor> {
  return { id: u.id, name: u.name, departmentId: u.departmentId };
}

export const isActiveOfficer = (u: CurrentUser | null) =>
  !!u && u.status === "active" && (u.role === "officer" || u.role === "admin");
export const isAdmin = (u: CurrentUser | null) => !!u && u.role === "admin" && u.status === "active";

/** Any signed-in, non-deactivated user. Redirects to sign-in otherwise. */
export async function requireUser(next = "/") {
  const u = await getCurrentUser();
  if (!u) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (u.status === "deactivated") redirect("/account?deactivated=1");
  return u;
}

/** Active officer (or admin). Use in every portal page AND server action. */
export async function requireOfficer() {
  const u = await requireUser("/portal");
  if (!isActiveOfficer(u)) redirect("/portal");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser("/admin/users");
  if (!isAdmin(u)) redirect("/");
  return u;
}

/**
 * Department scope for an officer. Officers act only on their own department;
 * admins (platform operators) may act on any department. Returns null for "all".
 */
export function departmentScope(u: CurrentUser): number | null {
  if (u.role === "admin") return null;
  return u.departmentId ?? -1; // -1 matches nothing if an officer somehow has no department
}

export function canActOnDepartment(u: CurrentUser, departmentId: number | null | undefined) {
  const scope = departmentScope(u);
  return scope === null || (departmentId != null && scope === departmentId);
}
