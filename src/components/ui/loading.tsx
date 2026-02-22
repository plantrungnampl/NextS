"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/shared";

type LoadingSkeletonBlockProps = {
  className?: string;
};

export function LoadingSkeletonBlock({ className }: LoadingSkeletonBlockProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "loading-shimmer rounded-md border border-white/10 bg-slate-900/65",
        className,
      )}
    />
  );
}

type LoadingInlineProps = {
  className?: string;
  label?: string;
};

export function LoadingInline({ className, label = "Đang tải..." }: LoadingInlineProps) {
  return (
    <div
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-xs text-slate-300", className)}
      role="status"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200/90" />
      <span>{label}</span>
    </div>
  );
}

type KanbanMotionLoaderProps = {
  className?: string;
  compact?: boolean;
  subtitle?: string;
  title?: string;
};

export function KanbanMotionLoader({
  className,
  compact = false,
  subtitle = "Sắp xếp các thẻ của bạn...",
  title = "Đang tải không gian làm việc",
}: KanbanMotionLoaderProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "kanban-loader-container flex w-full flex-col items-center justify-center",
        compact ? "gap-3" : "gap-5",
        className,
      )}
      role="status"
    >
      <div className={cn("kanban-loader-board", compact ? "kanban-loader-board-compact" : "")}>
        <div className="kanban-loader-col" />
        <div className="kanban-loader-col" />
        <div className="kanban-loader-col" />
        <div className="kanban-loader-card kanban-loader-card-1" />
        <div className="kanban-loader-card kanban-loader-card-2" />
        <div className="kanban-loader-card kanban-loader-card-3" />
      </div>
      <div className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
        <p
          className={cn(
            "kanban-loader-text-pulse text-center font-semibold tracking-wide text-slate-100",
            compact ? "text-base" : "text-xl",
          )}
        >
          {title}
        </p>
        {!compact ? <p className="text-center text-sm text-slate-300/85">{subtitle}</p> : null}
      </div>
    </div>
  );
}

type KanbanMotionLoaderCompactProps = {
  className?: string;
};

export function KanbanMotionLoaderCompact({ className }: KanbanMotionLoaderCompactProps) {
  return (
    <KanbanMotionLoader
      className={className}
      compact
      subtitle=""
      title="Đang tải chi tiết thẻ"
    />
  );
}

type LoadingCardModalSkeletonProps = {
  className?: string;
};

export function LoadingCardModalSkeleton({ className }: LoadingCardModalSkeletonProps) {
  return (
    <div
      className={cn(
        "flex min-h-[360px] w-full items-center justify-center rounded-2xl border border-slate-700/65 bg-slate-900/45 p-4",
        className,
      )}
    >
      <KanbanMotionLoaderCompact />
    </div>
  );
}

type LoadingBoardShellProps = {
  className?: string;
};

export function LoadingBoardShell({ className }: LoadingBoardShellProps) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)}>
      <KanbanMotionLoader />
    </div>
  );
}
