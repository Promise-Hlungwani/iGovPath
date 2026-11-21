"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Card, Input, Label, Notice } from "@/components/ui";

export function ForgotPasswordForm() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReady(true), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError("We couldn’t process your request. Please try again later.");
        return;
      }
      setSent(true);
    } catch {
      setError("We couldn’t process your request. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">Enter the email address linked to your account.</p>
      {sent ? (
        <div className="mt-5 space-y-4" aria-live="polite">
          <Notice tone="brand">If an account exists for this email, reset instructions are on the way. Check your inbox and spam folder.</Notice>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline" href="/sign-in">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} method="post" action="" className="mt-5 space-y-4">
          <div>
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" name="email" type="email" required autoComplete="email" />
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" disabled={busy || !ready} className="min-h-11 w-full">
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline" href="/sign-in">Back to sign in</Link>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => setReady(true), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    if (password !== confirmPassword) {
      setError("The passwords don’t match.");
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("This reset link can’t be used. Request a new one and try again.");
        return;
      }
      router.replace("/sign-in?passwordReset=success");
    } catch {
      setError("This reset link can’t be used. Request a new one and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token || invalid) {
    return (
      <Card className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold">Reset link unavailable</h1>
        <p className="mt-2 text-sm text-muted">This link is missing, invalid or expired. Request a new one to continue.</p>
        <Link className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand underline" href="/forgot-password">Request a new reset link</Link>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">Use at least 8 characters.</p>
      <form onSubmit={onSubmit} method="post" action="" className="mt-5 space-y-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" disabled={busy || !ready} className="min-h-11 w-full">
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </Card>
  );
}
