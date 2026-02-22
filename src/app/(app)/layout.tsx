import Link from "next/link";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

import { NotificationDropdown } from "./_components/notification-dropdown";
import { ProfileDropdown } from "./_components/profile-dropdown";

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

type SupabaseQueryErrorLike = {
  code?: string;
  message: string;
};

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

export default async function PrivateAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const [{ count: unreadCountValue, error: unreadCountError }, { data: recentNotificationRows, error: recentNotificationsError }] = await Promise.all([
    supabase
      .from("card_notification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabase
      .from("card_notification_events")
      .select("id, card_id, created_at")
      .eq("user_id", user.id)
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

  const recentNotifications = notificationRows.map((entry) => {
    const relatedCard = entry.card_id ? cardById.get(entry.card_id) : undefined;
    return {
      cardId: entry.card_id,
      cardTitle: relatedCard?.title ?? null,
      createdAt: entry.created_at,
      dueAt: relatedCard?.due_at ?? null,
      id: entry.id,
      isCompleted: relatedCard?.is_completed ?? false,
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
            <input
              className="h-9 w-full max-w-[600px] rounded-md border border-slate-600 bg-[#11161f] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-500"
              placeholder="Tìm kiếm"
              type="search"
            />
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
              {user.email}
            </p>
            <ProfileDropdown email={user.email} />
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100dvh-var(--app-header-height))] w-full px-3 py-3 sm:px-5 lg:px-6">{children}</main>
    </div>
  );
}
