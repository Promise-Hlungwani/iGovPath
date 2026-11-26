import "server-only";
import { env } from "@/lib/env";

/** Thrown when the AI service is down or refuses a request; message is safe to show officers. */
export class AiServiceError extends Error {}

const keyHeader = (): Record<string, string> => (env.AI_SERVICE_KEY ? { "x-igovpath-key": env.AI_SERVICE_KEY } : {});

async function call<T>(path: string, body: unknown, timeoutMs = 50_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new AiServiceError("The AI service is not reachable. Start it with `pnpm ai` and try again.");
  }
  if (!res.ok) {
    let msg = `AI service error (${res.status})`;
    try {
      const j = await res.json();
      msg = j.error || j.detail || msg;
    } catch {}
    throw new AiServiceError(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new AiServiceError("The AI service sent back something we couldn't read. Please try again.");
  }
}

export type Flag = { field: string; level: "error" | "warning"; message: string };
export type AdvertRecord = {
  department: string | null; post_title: string | null; reference_number: string | null; closing_date: string | null;
  salary: string | null; location: string | null; minimum_requirements: string[]; documents_required: string[];
  form_required: string | null;
  apply_route: { email: string | null; portal_url: string | null; postal: string | null; hand_delivery: string | null };
  contact: { name: string | null; phone: string | null };
  conditional_items: { item: string; when: string }[];
  province: string | null; opportunity_type: "post" | "internship" | "learnership"; evidence: Record<string, string>;
};
export type Amendment = {
  department: string | null; post_title: string | null; reference_number: string | null; original_circular: string | null;
  status_change: "amended" | "extended" | "withdrawn";
  changes: {
    closing_date: string | null; minimum_requirements: string[] | null;
    apply_route: AdvertRecord["apply_route"] | null; location: string | null; salary: string | null;
  };
  summary: string; evidence: Record<string, string>;
};
export type PageText = { page: number; text: string; blocks: { text: string; bbox: [number, number, number, number] }[]; ocr: boolean };

export async function intakePdf(bytes: Buffer, fileName: string, maxPages?: number) {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), fileName);
  if (maxPages) fd.append("max_pages", String(maxPages));
  let res: Response;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}/intake`, { method: "POST", body: fd, headers: keyHeader(), signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new AiServiceError("The AI service is not reachable. Start it with `pnpm ai` and try again.");
  }
  if (!res.ok) throw new AiServiceError(`Could not read the PDF (${res.status}).`);
  return (await res.json()) as { sha256: string; page_count: number; pages: PageText[] };
}

export type CvProfile = {
  highest_qualification: string | null; qualification_level: string; qualifications: string[]; fields_of_study: string[];
  skills: string[]; experience: { role: string; years: number | null }[]; total_years_experience: number | null;
  licences: string[]; languages: string[]; summary: string;
};
export type CvMatch = { id: string; fit: "strong" | "possible"; reasons: string[]; missing: string[] };

/** Send a CV for reading. The file is not stored by the AI service; personal details are removed before the AI sees it. */
export async function cvProfile(bytes: Buffer, fileName: string, consent: boolean) {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)]), fileName);
  fd.append("consent", consent ? "true" : "false");
  let res: Response;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}/cv/profile`, { method: "POST", body: fd, headers: keyHeader(), signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new AiServiceError("The AI service is not reachable. Please try again in a moment.");
  }
  if (!res.ok) {
    let msg = `Could not read the CV (${res.status}).`;
    try { const j = await res.json(); msg = j.error || j.detail || msg; } catch {}
    throw new AiServiceError(msg);
  }
  return (await res.json()) as { profile: CvProfile; personal_details_removed: number; model: string };
}

export const ai = {
  split: (pages: string[]) =>
    call<{ chunks: { chunk_ref: string; annexure: string; page: number; title: string; text: string }[] }>("/split", { pages }),
  extract: (text: string, isSample: boolean, documentDate?: string | null) =>
    call<{ record: AdvertRecord; flags: Flag[]; status: "draft" | "needs_fix"; model: string; attempts: number }>(
      "/extract", { text, is_sample: isSample, document_date: documentDate ?? null }),
  amendments: (text: string, isSample: boolean) =>
    call<{ amendments: { amendment: Amendment; flags: Flag[] }[]; model: string }>("/extract-amendments", { text, is_sample: isSample }),
  checklist: (record: unknown, isSample: boolean, sourceText: string | null, answers: Record<string, unknown> = {}) =>
    call<{ items: { group: string; item: string; source: string }[]; model: string }>("/checklist", { record, answers, source_text: sourceText, is_sample: isSample }),
  explain: (record: unknown, language: string, contact: string, isSample: boolean, profile = "") =>
    call<{ explanation: Record<string, string | string[]>; language: string; fact_check_passed: boolean; fact_problems: string[]; model: string }>(
      "/explain", { record, language, department_contact: contact, profile_summary: profile, is_sample: isSample }),
  draftCheck: (text: string, isSample: boolean) =>
    call<{ missing: { item: string; question_for_officer: string }[]; unclear: { sentence: string; suggestion: string }[]; model: string }>(
      "/draft-check", { text, is_sample: isSample }),
  formDetails: (text: string, isSample: boolean) =>
    call<{ name: string | null; code: string | null; version: string | null; effective_date: string | null; flags: Flag[]; model: string }>(
      "/form-details", { text, is_sample: isSample }),
  cvMatch: (profile: CvProfile, posts: unknown[], consent: boolean) =>
    call<{ matches: CvMatch[]; model: string }>("/cv/match", { profile, posts, consent }),
  assistant: (question: string, listings: unknown[], isSample: boolean) =>
    call<{ known: boolean; answer: string; listing_ids: string[]; model: string }>("/assistant", { question, listings, is_sample: isSample }),
};
