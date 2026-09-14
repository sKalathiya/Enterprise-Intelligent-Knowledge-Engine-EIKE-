import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BrandLockup } from "@/components/site/brand-lockup";
import { ThemeToggle } from "@/components/site/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <BrandLockup href="/" />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#about"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            About
          </Link>
          <Link
            href="/#contact"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            Contact
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonVariants({ size: "sm" })}>
            Register
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
