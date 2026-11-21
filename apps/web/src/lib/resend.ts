import "server-only";
import { env } from "@/lib/env";

export async function sendPasswordResetEmail(to: string, url: string) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Set RESEND_API_KEY and RESEND_FROM_EMAIL to send password reset emails.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your iGovPath password",
      text: `We received a request to reset your iGovPath password.\n\nUse this link to choose a new password:\n${url}\n\nIf you did not request this, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend could not send the password reset email (HTTP ${response.status}).`);
  }
}
