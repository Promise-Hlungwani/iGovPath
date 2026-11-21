import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { sendPasswordResetEmail } from "@/lib/resend";

const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Accept sign-ins from the live address and from Vercel preview deployments of this project.
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    env.APP_URL,
    // Vercel sets these automatically: the production address, this deployment, and the branch preview.
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      after(() => sendPasswordResetEmail(user.email, url));
    },
    onPasswordReset: async ({ user }) => {
      const [role] = await db
        .select({ departmentId: schema.userRoles.departmentId })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, user.id));
      await logAudit({
        actor: { id: user.id, name: user.name, departmentId: role?.departmentId ?? null },
        action: "user.password_reset",
        entity: "user",
        entityId: user.id,
        after: { passwordReset: true },
      });
    },
  },
  rateLimit: {
    customRules: {
      "/request-password-reset": { window: 300, max: 5 },
      "/reset-password": { window: 60, max: 10 },
    },
  },
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
