"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/auth/fields";
import { login } from "@/lib/api";
import { assignLoginAvatar } from "@/lib/profile-avatar";
import { notify } from "@/lib/stores/toast-store";

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    if ("message" in payload) {
      const message = (payload as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(" ") : message;
    }
    if ("error" in payload && typeof (payload as { error: unknown }).error === "string") {
      return (payload as { error: string }).error;
    }
  }
  return "Login failed. Check your email and password.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await login(email, password);
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = errorMessage(data);
        setError(message);
        notify.error("Sign in failed", message);
        return;
      }

      assignLoginAvatar();
      notify.success("Signed in", "Welcome back.");
      router.push("/documents");
      router.refresh();
    } catch {
      const message = "Could not sign you in. Try again.";
      setError(message);
      notify.error("Sign in failed", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="animate-fade-up text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Welcome back
      </p>
      <h1 className="animate-fade-up animate-delay-1 mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="animate-fade-up animate-delay-2 mt-2 text-sm leading-6 text-muted-foreground">
        Sign in with the email you used to create your account.
      </p>

      <form className="animate-fade-up animate-delay-3 mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={255}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClassName}
          />
        </label>

        {error ? (
          <div className="animate-shake rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </>
  );
}
