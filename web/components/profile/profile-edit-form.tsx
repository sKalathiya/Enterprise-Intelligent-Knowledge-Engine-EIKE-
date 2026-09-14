"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/auth/fields";
import { updateUser } from "@/lib/api";
import { notify } from "@/lib/stores/toast-store";
import { useUserStore, type AppUser } from "@/lib/stores/user-store";

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
  return "Could not save your changes.";
}

export function ProfileEditForm({ user }: { user: AppUser }) {
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);
  const loadUser = useUserStore((state) => state.loadUser);
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [email, setEmail] = useState(user.email);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setEmail(user.email);
  }, [user]);

  const unchanged =
    firstName.trim() === (user.firstName ?? "").trim() &&
    lastName.trim() === (user.lastName ?? "").trim() &&
    email.trim() === user.email.trim();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      const response = await updateUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const message = errorMessage(payload);
        setError(message);
        notify.error("Could not update profile", message);
        return;
      }

      setUser({
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      setSaved(true);
      notify.success("Profile updated", "Your details were saved.");
      void loadUser({ force: true });
    } catch {
      const message = "Could not save your changes. Try again.";
      setError(message);
      notify.error("Could not update profile", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">Edit your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Update the name and email on your account.
      </p>

      <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            First name
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              maxLength={255}
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setSaved(false);
              }}
              className={fieldClassName}
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
              onChange={(event) => {
                setLastName(event.target.value);
                setSaved(false);
              }}
              className={fieldClassName}
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
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
            className={fieldClassName}
          />
        </label>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        {saved ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            Saved.
          </p>
        ) : null}

        <Button type="submit" className="h-10 self-start px-4" disabled={pending || unchanged}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </section>
  );
}
