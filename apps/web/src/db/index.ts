import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon requires TLS; "verify-full" is what pg already does for "require", stated explicitly.
export const withSsl = (url: string) => url.replace(/sslmode=require/, "sslmode=verify-full");

const globalForDb = globalThis as unknown as { pool?: Pool };

// The app uses the pooled Neon connection; migrations use the direct one.
const pool =
  globalForDb.pool ??
  new Pool({ connectionString: withSsl(env.DATABASE_URL_POOLED || env.DATABASE_URL), max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
