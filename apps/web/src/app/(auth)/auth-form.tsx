"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button, Card, Input, Label, Notice } from "@/components/ui";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: String(f.get("name") || "").trim(), email, password })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message || "Something went wrong. Please try again.");
      return;
    }
    router.push(next.startsWith("/") ? next : "/account");
    router.refresh();
  }

  return (
    <Card className="max-w-md mx-auto">
      <h1 className="text-xl font-semibold">{mode === "sign-up" ? "Create an account" : "Sign in"}</h1>
      <p className="text-sm text-muted mt-1">
        {mode === "sign-up"
          ? "Applicants can use the app straight away. Government officers can request portal access after signing up."
          : "Welcome back."}
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {mode === "sign-up" && (
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
          {mode === "sign-up" && <p className="text-xs text-muted mt-1">At least 8 characters.</p>}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-muted mt-4">
        {mode === "sign-up" ? (
          <>Already have an account? <Link className="text-brand underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></>
        ) : (
          <>New here? <Link className="text-brand underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link></>
        )}
      </p>
    </Card>
  );
}
