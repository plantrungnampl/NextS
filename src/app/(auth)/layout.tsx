export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
