"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/shared";

import { signOut } from "../actions.auth";

function getInitials(email: string | undefined) {
  if (!email) {
    return "NB";
  }

  const base = email.split("@")[0]?.trim();
  if (!base) {
    return "NB";
  }

  const tokens = base
    .split(/[._-]/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return base.slice(0, 2).toUpperCase();
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function getDisplayName(email: string | undefined) {
  if (!email) {
    return "NexaBoard User";
  }

  const base = email.split("@")[0]?.trim();
  if (!base) {
    return "NexaBoard User";
  }

  return base
    .split(/[._-]/)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function DropdownAction({ children }: { children: string }) {
  return (
    <button
      className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
      type="button"
    >
      {children}
    </button>
  );
}

export function ProfileDropdown({ email }: { email: string | undefined }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayName = useMemo(() => getDisplayName(email), [email]);
  const initials = useMemo(() => getInitials(email), [email]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
          isOpen
            ? "border-sky-400 bg-sky-500/25 text-sky-100"
            : "border-slate-600 bg-slate-700/60 text-slate-100 hover:border-slate-400",
        )}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {initials}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-700 bg-[#232734] p-3 shadow-xl shadow-black/40"
          role="menu"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#1a1d28] p-2.5">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-200">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
              <p className="truncate text-xs text-slate-400">{email}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <DropdownAction>Switch account</DropdownAction>
            <DropdownAction>Manage account</DropdownAction>
            <DropdownAction>Activity</DropdownAction>
            <DropdownAction>Theme settings</DropdownAction>
          </div>

          <div className="mt-3 border-t border-slate-700 pt-2">
            <form action={signOut}>
              <button
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-rose-200 transition-colors hover:bg-rose-900/30 hover:text-rose-100"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
