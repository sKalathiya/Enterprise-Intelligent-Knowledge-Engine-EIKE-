import { AmbientBackground } from "@/components/motion/ambient-background";
import { AppHeader } from "@/components/site/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <AmbientBackground variant="soft" />
      <AppHeader />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:py-10 animate-fade-in">
        {children}
      </div>
    </div>
  );
}
