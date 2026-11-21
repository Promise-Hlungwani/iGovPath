"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OFFICER_STATUSES, setStatusByOfficer, type AppStatus } from "@/lib/applications";
import { safely } from "@/lib/safe-action";
import { requireOfficer } from "@/lib/session";

async function setApplicationStatusImpl(formData: FormData) {
  const u = await requireOfficer();
  const id = z.string().uuid().parse(formData.get("applicationId"));
  const status = z.enum(OFFICER_STATUSES as [AppStatus, ...AppStatus[]]).parse(formData.get("status"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  await setStatusByOfficer(u, id, status, note);
  revalidatePath("/portal/applications");
  redirect(`/portal/applications/${id}?updated=1`);
}

export async function setApplicationStatus(formData?: FormData) {
  return safely(() => setApplicationStatusImpl(formData as FormData), `/portal/applications/${formData?.get("applicationId") ?? ""}`);
}
