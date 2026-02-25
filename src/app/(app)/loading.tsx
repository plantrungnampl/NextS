import { LoadingBoardShell } from "@/components/ui";

export default function PrivateAppLoading() {
  return (
    <section className="relative isolate -mx-3 -my-3 flex h-[calc(100dvh-var(--app-header-height))] items-center justify-center overflow-hidden bg-[#070b18] pb-20 md:pb-24 sm:-mx-5 lg:-mx-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3f1b6b] via-[#1f1d3a] to-[#0f4d4c]" />
        <div className="absolute -left-20 -top-20 h-[22rem] w-[22rem] rounded-full bg-[#8b3dff]/45 blur-[110px]" />
        <div className="absolute right-[-5rem] top-16 h-[24rem] w-[24rem] rounded-full bg-emerald-400/35 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-cyan-400/25 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.25),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(129,140,248,0.2),transparent_42%)]" />
      </div>
      <div className="relative z-10 flex h-full w-full items-center justify-center p-6">
        <LoadingBoardShell className="h-auto w-auto" />
      </div>
    </section>
  );
}
