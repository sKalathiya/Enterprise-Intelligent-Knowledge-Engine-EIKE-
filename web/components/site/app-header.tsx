"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, MessageCircle } from "lucide-react";
import { ensureAvatarSeed } from "@/lib/profile-avatar";
import { useUserStore } from "@/lib/stores/user-store";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { BrandLockup } from "@/components/site/brand-lockup";
import { ThemeToggle } from "@/components/site/theme-toggle";

export function AppHeader() {
  const pathname = usePathname();
  const user = useUserStore((state) => state.user);
  const loadUser = useUserStore((state) => state.loadUser);
  const [seed, setSeed] = useState<string | null>(null);
  const onLibrary = pathname === "/documents" || pathname.startsWith("/documents/");
  const onChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const onProfile = pathname === "/profile" || pathname.startsWith("/profile/");
  const firstName = user?.firstName?.trim() || null;

  useEffect(() => {
    setSeed(ensureAvatarSeed());
    void loadUser();
  }, [loadUser]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4">
        <div className="flex min-w-0 flex-1 items-center">
          <BrandLockup href="/documents" />
          <span className="mx-3 hidden h-4 w-px bg-border sm:block" />
          <nav aria-label="Pages" className="flex items-center gap-1">
            <Link
              href="/documents"
              aria-current={onLibrary ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                onLibrary
                  ? "bg-accent font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              <FolderOpen className="size-4" />
              Library
            </Link>
            <Link
              href="/chat"
              aria-current={onChat ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                onChat
                  ? "bg-accent font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              <MessageCircle className="size-4" />
              Chat
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/profile"
            title="Your profile"
            aria-label="Open your profile"
            aria-current={onProfile ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
              onProfile ? "bg-accent text-primary" : "text-foreground hover:bg-accent/80"
            }`}
          >
            {seed ? (
              <ProfileAvatar seed={seed} size={36} />
            ) : (
              <span className="block size-9 rounded-full bg-muted" />
            )}
            <span className="pr-0.5 text-sm font-medium">{firstName ?? "Profile"}</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
