"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { register } from "@/lib/api";

const inputClassName =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  return "Registration failed. Check the form and try again.";
}

export function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await register(firstName, lastName, email, password);
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(data));
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setError("Could not reach the registration service. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        EIKE
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Register a workspace user, then sign in. No session is created until login.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            First name
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              maxLength={255}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Last name
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              maxLength={255}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>

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
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={255}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+"
            title="At least 8 characters, with one uppercase letter, one lowercase letter, and one number"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
          />
        </label>
        <p className="-mt-2 text-xs text-muted-foreground">
          At least 8 characters, including uppercase, lowercase, and a number.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-2 h-9 w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
