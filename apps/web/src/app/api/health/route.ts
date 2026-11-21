import { env } from "@/lib/env";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Admin-only status check for deployments: can the website reach the AI service?
 * Shows no secrets: only the AI service host, whether keys are set, and the AI service's own /health.
 */
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!isAdmin(u)) return Response.json({ error: "Admins only" }, { status: 403 });

  const url = env.AI_SERVICE_URL;
  const out: Record<string, unknown> = {
    website: "ok",
    ai_service_url_host: (() => { try { return new URL(url).host; } catch { return "invalid"; } })(),
    ai_service_url_is_localhost: /localhost|127\.0\.0\.1/.test(url),
    ai_service_key_set: !!env.AI_SERVICE_KEY,
    running_on_vercel: !!process.env.VERCEL,
  };
  try {
    const r = await fetch(`${url}/health`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    out.ai_service_status = r.status;
    out.ai_service = await r.json().catch(() => "not JSON");
  } catch (e) {
    out.ai_service_status = "unreachable";
    out.ai_service_error = e instanceof Error ? e.message : String(e);
  }
  if (out.running_on_vercel && out.ai_service_url_is_localhost) {
    out.hint = "AI_SERVICE_URL points to localhost. Delete AI_SERVICE_URL in Vercel's Environment Variables and redeploy; the service binding fills it in.";
  }
  return Response.json(out);
}
