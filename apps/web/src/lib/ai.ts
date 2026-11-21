import "server-only";
import { env } from "@/lib/env";

/** Thrown when the AI service is down or refuses a request; message is safe to show officers. */
export class AiServiceError extends Error {}

async function call<T>(path: string, body: unknown, timeoutMs = 120_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  return (await res.json()) as T;
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
    res = await fetch(`${env.AI_SERVICE_URL}/intake`, { method: "POST", body: fd, signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new AiServiceError("The AI service is not reachable. Start it with `pnpm ai` and try again.");
  }
  if (!res.ok) throw new AiServiceError(`Could not read the PDF (${res.status}).`);
  return (await res.json()) as { sha256: string; page_count: number; pages: PageText[] };
}

export const ai = {
  split: (pages: string[]) =>
    call<{ chunks: { chunk_ref: string; annexure: string; page: number; title: string; text: string }[] }>("/split", { pages }),
  extract: (text: string, isSample: boolean, documentDate?: string | null) =>
    call<{ record: AdvertRecord; flags: Flag[]; status: "draft" | "needs_fix"; model: string; attempts: number }>(
      "/extract", { text, is_sample: isSample, document_date: documentDate ?? null }),
  amendments: (text: string, isSample: boolean) =>
    call<{ amendments: { amendment: Amendment; flags: Flag[] }[]; model: string }>("/extract-amendments", { text, is_sample: isSample }),
  checklist: (record: unknown, isSample: boolean, answers: Record<string, unknown> = {}) =>
    call<{ items: { group: string; item: string; source: string }[]; model: string }>("/checklist", { record, answers, is_sample: isSample }),
  explain: (record: unknown, language: string, contact: string, isSample: boolean, profile = "") =>
    call<{ explanation: Record<string, string | string[]>; language: string; fact_check_passed: boolean; fact_problems: string[]; model: string }>(
      "/explain", { record, language, department_contact: contact, profile_summary: profile, is_sample: isSample }),
  draftCheck: (text: string, isSample: boolean) =>
    call<{ missing: { item: string; question_for_officer: string }[]; unclear: { sentence: string; suggestion: string }[]; model: string }>(
      "/draft-check", { text, is_sample: isSample }),
  assistant: (question: string, listings: unknown[], isSample: boolean) =>
    call<{ known: boolean; answer: string; listing_ids: string[]; model: string }>("/assistant", { question, listings, is_sample: isSample }),
};
