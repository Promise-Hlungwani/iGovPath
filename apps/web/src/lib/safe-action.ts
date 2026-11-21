import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

/** Turn any error into a sentence that is safe and useful to show a person. */
export function messageFor(e: unknown): string {
  if (e instanceof ZodError) return "Some information is missing or not valid. Please check the form and try again.";
  // Our own errors (AI service, publishing) already carry messages written for people.
  if (e instanceof Error && ["AiServiceError", "PublishError", "UserFacingError"].includes(e.constructor.name)) return e.message;
  if (e instanceof Error && /ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection terminated|timeout/i.test(e.message)) {
    return "We couldn't reach one of our services just now. Please try again in a moment.";
  }
  return "Something went wrong on our side. Please try again. If it keeps happening, tell the iGovPath team.";
}

export class UserFacingError extends Error {}

function withError(path: string, message: string) {
  const url = new URL(path, "http://local");
  url.searchParams.set("error", message);
  return `${url.pathname}${url.search}`;
}

/**
 * Run a server action so a failure never crashes the app. Next.js redirects/notFound still
 * pass through; anything else is logged and the person is sent back to `errorPath` with a message.
 */
export async function safely<T>(run: () => Promise<T>, errorPath: string): Promise<T> {
  try {
    return await run();
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[action failed] ${errorPath}:`, e);
    redirect(withError(errorPath, messageFor(e)));
  }
}
