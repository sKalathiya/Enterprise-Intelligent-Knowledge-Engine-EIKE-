"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/api";

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
        setError(errorMessage(data));
        return;
      }

      router.push("/documents");
      router.refresh();
    } catch {
      setError("Could not reach the login service. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        EIKE
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your workspace email. The session is stored in an HttpOnly cookie.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
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
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-2 h-9 w-full" disabled={pending}>
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
