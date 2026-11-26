import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon requires TLS; "verify-full" is what pg already does for "require", stated explicitly.
export const withSsl = (url: string) => url.replace(/sslmode=require/, "sslmode=verify-full");

const globalForDb = globalThis as unknown as { pool?: Pool };

// The app uses the pooled Neon connection; migrations use the direct one.
function createPool() {
  const p = new Pool({
    connectionString: withSsl(env.DATABASE_URL_POOLED || env.DATABASE_URL),
    max: 5,
    // Opening a connection to Neon costs over a second, so keep idle ones for 5 minutes
    // (Neon's pooler keeps them longer) instead of reopening after every short pause.
    idleTimeoutMillis: 5 * 60_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });
  // IMPORTANT: without this listener, a connection closed by the database server raises an
  // unhandled 'error' event and Node shuts the whole web server down (the "app keeps dying"
  // problem). Log it and carry on; the pool replaces the broken connection on the next query.
  p.on("error", (err) => {
    console.error("[db] idle connection error (recovered, app keeps running):", err.message);
  });
  // Warm two connections in the background so the first clicks don't pay the connection cost.
  for (let i = 0; i < 2; i++) p.connect().then((c) => c.release(), () => {});
  return p;
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
