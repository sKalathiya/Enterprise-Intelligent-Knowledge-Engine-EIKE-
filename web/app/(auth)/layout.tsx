export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4">
      <main className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </main>
    </div>
  );
}
