import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { BrandLogo } from "@/components/site/brand-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-card">
      <Reveal className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">Folio</p>
              <p className="text-[11px] text-muted-foreground">Your private library</p>
            </div>
          </div>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            A simple way to keep your documents close and find answers without searching
            through folders.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/#about" className="transition-colors hover:text-primary">
                About
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="transition-colors hover:text-primary">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-primary">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition-colors hover:text-primary">
                Get started
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Contact</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="mailto:hello@eike.app" className="transition-colors hover:text-primary">
                hello@eike.app
              </a>
            </li>
          </ul>
        </div>
      </Reveal>
      <div className="border-t border-border/80">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Folio. All rights reserved.</p>
          <p>Your files stay in your account. Only you can see them.</p>
        </div>
      </div>
    </footer>
  );
}
