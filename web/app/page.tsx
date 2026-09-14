import Link from "next/link";
import { FileText, FolderOpen, MessageCircle, Shield, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const capabilities = [
  {
    title: "Add your files",
    body: "Drop in a PDF or a text file. Folio reads it and adds it to your personal library.",
    icon: Upload,
  },
  {
    title: "See what’s ready",
    body: "Watch each file move from uploading to ready. If something fails, try again or remove it.",
    icon: FolderOpen,
  },
  {
    title: "Ask in plain language",
    body: "Type a question the way you would ask a colleague. Answers come from your own documents.",
    icon: MessageCircle,
  },
  {
    title: "Kept private to you",
    body: "Only you can see the files in your account. Nothing is shared with other people on Folio.",
    icon: Shield,
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <AmbientBackground />
      <div className="relative z-10 flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1fr_19rem]">
            <div>
              <p className="animate-fade-up text-xs font-medium tracking-wide text-primary uppercase">
                Your team’s knowledge, in one place
              </p>
              <h1 className="animate-fade-up animate-delay-1 mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Find answers in the documents you already have.
              </h1>
              <p className="animate-fade-up animate-delay-2 mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Upload policies, reports, and notes. Then ask a question and get a clear answer
                from your own files — without digging through folders.
              </p>
              <div className="animate-fade-up animate-delay-3 mt-8 flex flex-wrap gap-3">
                <Link href="/register" className={`${buttonVariants({ size: "lg" })} transition-transform hover:-translate-y-0.5`}>
                  Get started
                </Link>
                <Link
                  href="/login"
                  className={`${buttonVariants({ variant: "outline", size: "lg" })} bg-card transition-transform hover:-translate-y-0.5`}
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="relative hidden min-h-64 lg:block">
              <div className="animate-fade-up animate-delay-3 absolute top-0 right-2 w-64">
                <div className="animate-float-slow rounded-2xl border border-border/80 bg-card p-4 shadow-md">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Library</p>
                  <p className="mt-2 truncate text-sm font-medium">Leave policy.pdf</p>
                  <p className="mt-1 text-xs text-primary">Ready to ask</p>
                </div>
              </div>
              <div className="animate-fade-up animate-delay-4 absolute top-28 left-0 w-60">
                <div className="animate-float rounded-2xl border border-border/80 bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg">
                  What is our leave policy?
                </div>
              </div>
              <div className="animate-fade-up animate-delay-5 absolute top-48 right-0 w-64">
                <div className="animate-float-slow rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm leading-6 text-muted-foreground shadow-md">
                  Full-time staff receive 20 days of paid leave each year.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border/80 bg-card">
          <div className="mx-auto w-full max-w-5xl px-4 py-16">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            </Reveal>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Create your account",
                  body: "Sign up with your work email. It only takes a minute.",
                },
                {
                  step: "2",
                  title: "Add your documents",
                  body: "Upload a PDF or text file. You’ll see when it’s ready to use.",
                },
                {
                  step: "3",
                  title: "Ask a question",
                  body: "Search your library in everyday language and get an answer you can check.",
                },
              ].map((item, index) => (
                <Reveal
                  key={item.step}
                  as="li"
                  delay={(index + 1) as 1 | 2 | 3}
                  className="hover-lift rounded-2xl border border-border/80 bg-background p-5"
                >
                  <p className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {item.step}
                  </p>
                  <h3 className="mt-4 font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">What you can do</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {capabilities.map((item, index) => (
              <Reveal
                key={item.title}
                as="article"
                delay={((index % 4) + 1) as 1 | 2 | 3 | 4}
                className="group hover-lift rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary transition-transform duration-300 group-hover:scale-105">
                  <item.icon className="size-6" />
                </span>
                <h3 className="mt-3 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="about" className="border-y border-border/80 bg-card">
          <Reveal className="mx-auto w-full max-w-5xl px-4 py-16">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <FileText className="size-6" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">About</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Folio helps people get useful answers from the documents they already work with.
                  Instead of searching through shared drives, you keep a private library and ask
                  questions in your own words. Your files belong to your account and are not
                  visible to anyone else.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="contact" className="mx-auto w-full max-w-5xl px-4 py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">Contact</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Need help getting started, or want Folio for your team? Write to us at{" "}
              <a href="mailto:hello@eike.app" className="font-medium text-primary underline-offset-4 hover:underline">
                hello@eike.app
              </a>
              . We usually reply within one business day.
            </p>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
      </div>
    </div>
  );
}
