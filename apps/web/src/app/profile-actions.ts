"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PROFILE_COOKIE } from "@/lib/profile";
import { safely } from "@/lib/safe-action";
import { getCurrentUser, isActiveOfficer, isAdmin } from "@/lib/session";

async function switchProfileImpl(formData: FormData) {
  const to = formData.get("to") === "officer" ? "officer" : "personal";
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  const canOfficer = isActiveOfficer(u) || isAdmin(u);
  const profile = to === "officer" && canOfficer ? "officer" : "personal";
  (await cookies()).set(PROFILE_COOKIE, profile, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  redirect(profile === "officer" ? (isActiveOfficer(u) ? "/portal" : "/admin/users") : "/search");
}

export async function switchProfile(formData?: FormData) {
  return safely(() => switchProfileImpl(formData as FormData), "/account");
}
