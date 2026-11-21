import "server-only";
import path from "node:path";

export const REPO_ROOT = path.resolve(process.cwd(), "../..");
export const UPLOAD_DIR = path.join(REPO_ROOT, "data", "uploads");

/** Resolve a repo-relative stored path, refusing anything outside data/. */
export function resolveDataPath(rel: string) {
  const full = path.resolve(REPO_ROOT, rel);
  if (!full.startsWith(path.join(REPO_ROOT, "data") + path.sep)) throw new Error("Invalid file path");
  return full;
}
