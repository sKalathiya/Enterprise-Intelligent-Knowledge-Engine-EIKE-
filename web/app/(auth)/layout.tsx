import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { BrandLockup } from "@/components/site/brand-lockup";
import { ThemeToggle } from "@/components/site/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <AmbientBackground variant="soft" />
      <header className="relative z-10 sticky top-0 border-b border-border/80 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <BrandLockup href="/" />
          <nav className="flex items-center gap-2">
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Home
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
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <main className="animate-fade-up w-full max-w-md rounded-2xl border border-border/80 bg-card/90 p-8 shadow-sm backdrop-blur-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
