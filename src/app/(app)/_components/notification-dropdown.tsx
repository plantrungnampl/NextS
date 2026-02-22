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
  cardId: string | null;
  cardTitle: string | null;
  createdAt: string;
  dueAt: string | null;
  id: string;
  isCompleted: boolean;
};

type NotificationDropdownProps = {
  items: NotificationItem[];
  unreadCount: number;
};

function formatRelativeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Vừa xong";
  }

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function formatDueDate(value: string | null): string {
  if (!value) {
    return "Chưa có hạn";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Chưa có hạn";
  }

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function resolveDueStatusLabel(dueAt: string | null, isCompleted: boolean): string {
  if (isCompleted) {
    return "Đã hoàn thành";
  }

  if (!dueAt) {
    return "Không có hạn cụ thể";
  }

  const parsedDueDate = new Date(dueAt);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return "Không xác định hạn";
  }

  const now = new Date();
  if (parsedDueDate.getTime() < now.getTime()) {
    return "Đã quá hạn";
  }

  if (isSameLocalDay(parsedDueDate, now)) {
    return "Đến hạn hôm nay";
  }

  const upcomingWindowMs = 24 * 60 * 60 * 1000;
  if (parsedDueDate.getTime() - now.getTime() <= upcomingWindowMs) {
    return "Sắp đến hạn";
  }

  return "Còn thời gian";
}

function resolveNotificationTitle(item: NotificationItem): string {
  if (item.cardTitle && item.cardTitle.trim().length > 0) {
    return item.cardTitle.trim();
  }

  if (item.cardId) {
    return `Thẻ #${item.cardId.slice(0, 8)}`;
  }

  return "Thẻ không xác định";
}

export function NotificationDropdown({ items, unreadCount }: NotificationDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative hidden h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:inline-flex"
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

      <DropdownMenuContent align="end" className="w-[280px] p-0">
        <DropdownMenuLabel>Nhắc nhở thẻ</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto p-1">
          {items.length < 1 ? (
            <p className="rounded px-2 py-2 text-xs text-slate-400">Không có nhắc nhở mới.</p>
          ) : (
            items.map((item) => (
              <div className="rounded px-2 py-2 text-xs text-slate-200 hover:bg-slate-800" key={item.id}>
                <p className="line-clamp-1 font-medium">Nhắc hạn: {resolveNotificationTitle(item)}</p>
                <p className="mt-1 text-[11px] text-slate-300">Hạn: {formatDueDate(item.dueAt)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {resolveDueStatusLabel(item.dueAt, item.isCompleted)} • Nhắc lúc {formatRelativeDate(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
