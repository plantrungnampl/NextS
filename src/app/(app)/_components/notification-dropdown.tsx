"use client";

import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  remindedAtLabel: string;
  statusLabel: string;
  title: string;
  dueLabel: string;
};

type NotificationDropdownProps = {
  items: NotificationItem[];
  unreadCount: number;
};

export function NotificationDropdown({ items, unreadCount }: NotificationDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative hidden h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:inline-flex"
          id="app-notification-trigger"
          type="button"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-sky-950">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[280px] p-0" id="app-notification-content">
        <DropdownMenuLabel>Nhắc nhở thẻ</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto p-1">
          {items.length < 1 ? (
            <p className="rounded px-2 py-2 text-xs text-slate-400">Không có nhắc nhở mới.</p>
          ) : (
            items.map((item) => (
              <div className="rounded px-2 py-2 text-xs text-slate-200 hover:bg-slate-800" key={item.id}>
                <p className="line-clamp-1 font-medium">Nhắc hạn: {item.title}</p>
                <p className="mt-1 text-[11px] text-slate-300">Hạn: {item.dueLabel}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {item.statusLabel} • Nhắc lúc {item.remindedAtLabel}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
