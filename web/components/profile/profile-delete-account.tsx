"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/auth/fields";
import { deleteUser } from "@/lib/api";
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
  return "Could not delete your account.";
}

function emailsMatch(typed: string, actual: string) {
  return typed.trim().toLowerCase() === actual.trim().toLowerCase();
}

export function ProfileDeleteAccount({ user }: { user: AppUser }) {
  const router = useRouter();
  const clearUser = useUserStore((state) => state.clearUser);
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = emailsMatch(typedEmail, user.email);

  function close() {
    setOpen(false);
    setTypedEmail("");
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) {
      setError("Type your email exactly to confirm.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const response = await deleteUser();
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const message = errorMessage(payload);
        setError(message);
        notify.error("Could not delete account", message);
        return;
      }

      clearUser();
      notify.success("Account deleted", "Your account and files were removed.");
      router.push("/");
      router.refresh();
    } catch {
      const message = "Could not delete your account. Try again.";
      setError(message);
      notify.error("Could not delete account", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-destructive/25 bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight text-destructive">Delete account</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        This removes your account and the files in it. This cannot be undone.
      </p>

      {!open ? (
        <Button type="button" variant="destructive" className="mt-5 h-10 px-4" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      ) : (
        <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type <span className="font-semibold">{user.email}</span> to confirm
            <input
              type="email"
              name="confirmEmail"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
              value={typedEmail}
              onChange={(event) => {
                setTypedEmail(event.target.value);
                setError(null);
              }}
              className={fieldClassName}
              placeholder="Your email"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="h-10 px-4"
              disabled={pending || !confirmed}
            >
              {pending ? "Deleting…" : "Delete my account"}
            </Button>
            <Button type="button" variant="outline" className="h-10 bg-card px-4" disabled={pending} onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
