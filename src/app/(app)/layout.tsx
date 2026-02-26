import Link from "next/link";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import { HeaderWorkspaceSearch } from "./_components/header-workspace-search";
import { NotificationDropdown } from "./_components/notification-dropdown";
import { ProfileDropdown } from "./_components/profile-dropdown";

export const dynamic = "force-dynamic";

type NotificationRow = {
  card_id: string | null;
  created_at: string;
  id: string;
};

type NotificationCardRow = {
  due_at: string | null;
  id: string;
  is_completed: boolean;
  title: string;
};

type NotificationViewItem = {
  dueLabel: string;
  id: string;
  remindedAtLabel: string;
  statusLabel: string;
  title: string;
};

type SupabaseQueryErrorLike = {
  code?: string;
  message: string;
};

const NOTIFICATION_LOCALE = "vi-VN";
const NOTIFICATION_TIME_ZONE = "Asia/Ho_Chi_Minh";
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

function isMissingTableSchemaCacheError(
  error: SupabaseQueryErrorLike | null,
  tableName: string,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes(tableName.toLowerCase()) &&
    (normalizedMessage.includes("schema cache") || normalizedMessage.includes("could not find the table"))
  );
}

function resolveNotificationTitle(cardTitle: string | null, cardId: string | null): string {
  if (cardTitle && cardTitle.trim().length > 0) {
    return cardTitle.trim();
  }

  if (cardId) {
    return `Thẻ #${cardId.slice(0, 8)}`;
  }

  return "Thẻ không xác định";
}

function createDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: NOTIFICATION_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function formatNotificationDate(
  value: string | null,
  options: { includeYear: boolean; fallback: string },
): string {
  if (!value) {
    return options.fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return options.fallback;
  }

  const formatter = new Intl.DateTimeFormat(NOTIFICATION_LOCALE, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    ...(options.includeYear ? { year: "numeric" } : {}),
    timeZone: NOTIFICATION_TIME_ZONE,
  });

  return formatter.format(parsed);
}

function resolveDueStatusLabelAt(
  dueAt: string | null,
  isCompleted: boolean,
  nowSnapshotIso: string,
): string {
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

  const now = new Date(nowSnapshotIso);
  if (Number.isNaN(now.getTime())) {
    return "Không xác định hạn";
  }

  if (parsedDueDate.getTime() < now.getTime()) {
    return "Đã quá hạn";
  }

  if (createDateKey(parsedDueDate) === createDateKey(now)) {
    return "Đến hạn hôm nay";
  }

  if (parsedDueDate.getTime() - now.getTime() <= UPCOMING_WINDOW_MS) {
    return "Sắp đến hạn";
  }

  return "Còn thời gian";
}

export default async function PrivateAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    redirect(APP_ROUTES.login);
  }

  const userId = authContext.userId;
  const userEmail = authContext.email ?? "";
  const supabase = await createServerSupabaseClient();

  const [{ count: unreadCountValue, error: unreadCountError }, { data: recentNotificationRows, error: recentNotificationsError }] = await Promise.all([
    supabase
      .from("card_notification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
    supabase
      .from("card_notification_events")
      .select("id, card_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const notificationTableMissing =
    isMissingTableSchemaCacheError(unreadCountError, "card_notification_events") ||
    isMissingTableSchemaCacheError(recentNotificationsError, "card_notification_events");
  if (!notificationTableMissing && (unreadCountError || recentNotificationsError)) {
    throw new Error(
      unreadCountError?.message ??
      recentNotificationsError?.message ??
      "Failed to load card notifications.",
    );
  }
  const unreadCount = notificationTableMissing ? 0 : (unreadCountValue ?? 0);
  const notificationRows = notificationTableMissing
    ? []
    : ((recentNotificationRows ?? []) as NotificationRow[]);
  const notificationCardIds = Array.from(
    new Set(
      notificationRows
        .map((entry) => entry.card_id)
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    ),
  );

  const cardById = new Map<string, NotificationCardRow>();
  if (notificationCardIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("cards")
      .select("id, title, due_at, is_completed")
      .in("id", notificationCardIds);
    for (const row of (cardRows ?? []) as NotificationCardRow[]) {
      cardById.set(row.id, row);
    }
  }

  const nowSnapshotIso = new Date().toISOString();

  const recentNotifications: NotificationViewItem[] = notificationRows.map((entry) => {
    const relatedCard = entry.card_id ? cardById.get(entry.card_id) : undefined;
    return {
      dueLabel: formatNotificationDate(relatedCard?.due_at ?? null, {
        fallback: "Chưa có hạn",
        includeYear: true,
      }),
      id: entry.id,
      remindedAtLabel: formatNotificationDate(entry.created_at, {
        fallback: "Vừa xong",
        includeYear: false,
      }),
      statusLabel: resolveDueStatusLabelAt(
        relatedCard?.due_at ?? null,
        relatedCard?.is_completed ?? false,
        nowSnapshotIso,
      ),
      title: resolveNotificationTitle(relatedCard?.title ?? null, entry.card_id),
    };
  });

  return (
    <div className="min-h-screen bg-[#111318]">
      <header className="sticky top-0 z-30 h-[var(--app-header-height)] w-full border-b border-slate-700 bg-[#1b1f29]">
        <div className="flex h-full w-full items-center gap-3 px-3 py-2 sm:px-5 lg:px-6">
          <Link
            className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800"
            href={APP_ROUTES.workspace.index}
          >
            NexaBoard
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <HeaderWorkspaceSearch />
            <Link
              className="inline-flex h-9 shrink-0 items-center rounded-md bg-sky-500 px-3 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-400"
              href={`${APP_ROUTES.workspace.index}?createBoard=1`}
            >
              Tạo mới
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationDropdown items={recentNotifications} unreadCount={unreadCount} />
            <button
              className="hidden h-8 w-8 items-center justify-center rounded-md text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:inline-flex"
              type="button"
            >
              ?
            </button>
            <p className="hidden rounded-md bg-[#131722] px-2 py-1 text-xs text-slate-300 lg:block">
              {userEmail}
            </p>
            <ProfileDropdown email={userEmail} />
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100dvh-var(--app-header-height))] w-full px-3 py-3 sm:px-5 lg:px-6">{children}</main>
    </div>
  );
}
