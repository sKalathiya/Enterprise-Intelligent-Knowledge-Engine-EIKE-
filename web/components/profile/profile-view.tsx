"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Moon, Shield, Sun, UserRound } from "lucide-react";
import { ensureAvatarSeed } from "@/lib/profile-avatar";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useUserStore } from "@/lib/stores/user-store";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileDeleteAccount } from "@/components/profile/profile-delete-account";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

function displayName(firstName?: string | null, lastName?: string | null, email?: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return email?.split("@")[0] || "Your profile";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfileView() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const status = useUserStore((state) => state.status);
  const error = useUserStore((state) => state.error);
  const loadUser = useUserStore((state) => state.loadUser);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [seed, setSeed] = useState<string | null>(null);
  const loading = status === "idle" || status === "loading";
  const night = theme === "dark";

  useEffect(() => {
    setSeed(ensureAvatarSeed());

    let cancelled = false;
    async function load() {
      const result = await loadUser();
      if (!cancelled && result === "unauthorized") {
        router.push("/login");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadUser, router]);

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your name, email, and the picture chosen for this visit. You can change your details or delete your account here.
        </p>
      </div>

      {error && error !== "unauthorized" ? (
        <div className="animate-shake rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="bg-[radial-gradient(ellipse_at_top,oklch(0.88_0.06_185/0.45),transparent_70%)] px-6 pt-8 pb-10 dark:bg-[radial-gradient(ellipse_at_top,oklch(0.34_0.05_185/0.4),transparent_70%)]">
          <div className="flex flex-col items-center text-center">
            {seed ? (
              <ProfileAvatar seed={seed} size={128} className="shadow-md ring-4 ring-card" />
            ) : (
              <span className="size-32 rounded-full bg-muted" />
            )}
            {loading ? (
              <div className="mt-5 space-y-2">
                <div className="mx-auto h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="mx-auto h-4 w-52 animate-pulse rounded bg-muted" />
              </div>
            ) : user ? (
              <>
                <h2 className="mt-5 text-xl font-semibold tracking-tight">
                  {displayName(user.firstName, user.lastName, user.email)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                <span
                  className={`mt-3 rounded-full px-2.5 py-1 text-xs font-medium ${
                    user.isActive === false
                      ? "bg-destructive/10 text-destructive"
                      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  }`}
                >
                  {user.isActive === false ? "Inactive" : "Active"}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {!loading && user ? (
          <ul className="divide-y divide-border/80">
            <li className="flex items-start gap-3 px-6 py-4">
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <UserRound className="size-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="mt-0.5 text-sm font-medium">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || "Not added yet"}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 px-6 py-4">
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <Mail className="size-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="mt-0.5 text-sm font-medium">{user.email}</p>
              </div>
            </li>
            <li className="flex items-start gap-3 px-6 py-4">
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <Shield className="size-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="mt-0.5 text-sm font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </li>
            <li className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  {night ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Appearance</p>
                  <p className="mt-0.5 text-sm font-medium">{night ? "Night view" : "Day view"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {night ? "Use day view" : "Use night view"}
              </button>
            </li>
          </ul>
        ) : null}
      </section>

      {!loading && user ? (
        <>
          <ProfileEditForm user={user} />
          <ProfileDeleteAccount user={user} />
        </>
      ) : null}

      <LogoutButton variant="outline" className="h-8 self-start bg-card" />
    </div>
  );
}
