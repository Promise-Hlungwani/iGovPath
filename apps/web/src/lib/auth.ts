import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit";

const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  // Email + password only; no email verification or reset yet (PLAN.md §2).
  emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: false },
  // Keep the session in a signed cookie for 5 minutes so each page doesn't wait on a database lookup.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  databaseHooks: {
    user: {
      create: {
        // Every new account starts as an active applicant, except ADMIN_EMAIL which becomes admin.
        after: async (u) => {
          const isAdmin = !!adminEmail && u.email.trim().toLowerCase() === adminEmail;
          const role = isAdmin ? "admin" : "applicant";
          await db
            .insert(schema.userRoles)
            .values({ userId: u.id, role, status: "active", approvedAt: isAdmin ? new Date() : null })
            .onConflictDoNothing();
          await logAudit({
            actor: { id: u.id, name: u.name, departmentId: null },
            action: "user.sign_up",
            entity: "user",
            entityId: u.id,
            after: { role, status: "active" },
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});
