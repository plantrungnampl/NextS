import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Star } from "lucide-react";

import { Button } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cn, getFirstQueryParamValue } from "@/shared";

import {
  createBoardDialogHref,
  resolveWorkspaceSearchParams,
  type WorkspacePageSearchParams,
} from "./page.data";
import { CreateBoardModal } from "./_components/create-board-modal";
import { WorkspaceSidebar } from "./_components/workspace-sidebar";

type WorkspaceSummary = {
  created_at: string;
  id: string;
  name: string;
  slug: string;
};

type WorkspaceMembership = {
  role: "owner" | "admin" | "member";
  workspace_id: string;
};

type BoardSummary = {
  created_at: string;
  description: string | null;
  id: string;
  is_favorite: boolean;
  name: string;
  workspace_id: string;
};

type WorkspacePageProps = {
  searchParams?: WorkspacePageSearchParams | Promise<WorkspacePageSearchParams>;
};

type BoardTileProps = {
  board: BoardSummary;
  href: string;
  label: string;
  paletteIndex: number;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseErrorLike = {
  code?: string;
  message: string;
};

type WorkspaceDashboardData = {
  boardsByWorkspaceId: Map<string, BoardSummary[]>;
  recentBoards: BoardSummary[];
  roleByWorkspaceId: Map<string, WorkspaceMembership["role"]>;
  workspaceNameById: Map<string, string>;
  workspaces: WorkspaceSummary[];
};

const BOARD_GRADIENTS = [
  "from-violet-400 to-fuchsia-500",
  "from-sky-400 to-indigo-500",
  "from-cyan-400 to-sky-500",
  "from-emerald-400 to-cyan-500",
] as const;

function isMissingBoardFavoritesTableError(error: SupabaseErrorLike | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205" || error.code === "42P01") {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("board_favorites")
    && (normalizedMessage.includes("schema cache") || normalizedMessage.includes("could not find the table"))
  );
}

async function getWorkspaceDashboardData(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<WorkspaceDashboardData> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (membershipsError) {
    throw new Error(`Failed to load memberships: ${membershipsError.message}`);
  }

  const typedMemberships = (memberships ?? []) as WorkspaceMembership[];
  const workspaceIds = typedMemberships.map((membership) => membership.workspace_id);
  const roleByWorkspaceId = new Map(
    typedMemberships.map((membership) => [membership.workspace_id, membership.role]),
  );

  let workspaces: WorkspaceSummary[] = [];
  let boards: BoardSummary[] = [];
  if (workspaceIds.length > 0) {
    const [{ data: workspaceData, error: workspaceError }, { data: boardData, error: boardError }] =
      await Promise.all([
        supabase
          .from("workspaces")
          .select("id, slug, name, created_at")
          .in("id", workspaceIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("boards")
          .select("id, workspace_id, name, description, created_at")
          .in("workspace_id", workspaceIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      ]);

    if (workspaceError) {
      throw new Error(`Failed to load workspaces: ${workspaceError.message}`);
    }

    if (boardError) {
      throw new Error(`Failed to load boards: ${boardError.message}`);
    }

    workspaces = (workspaceData ?? []) as WorkspaceSummary[];
    const rawBoards = (boardData ?? []) as Omit<BoardSummary, "is_favorite">[];
    const boardIds = rawBoards.map((board) => board.id);
    let favoriteBoardIds = new Set<string>();

    if (boardIds.length > 0) {
      const { data: boardFavorites, error: boardFavoritesError } = await supabase
        .from("board_favorites")
        .select("board_id")
        .eq("user_id", userId)
        .in("board_id", boardIds);

      if (!boardFavoritesError) {
        favoriteBoardIds = new Set(
          ((boardFavorites ?? []) as { board_id: string }[]).map((entry) => entry.board_id),
        );
      } else if (!isMissingBoardFavoritesTableError(boardFavoritesError as SupabaseErrorLike)) {
        throw new Error(`Failed to load board favorites: ${boardFavoritesError.message}`);
      }
    }

    boards = rawBoards
      .map((board) => ({
        ...board,
        is_favorite: favoriteBoardIds.has(board.id),
      }))
      .sort((left, right) => {
        if (left.is_favorite !== right.is_favorite) {
          return left.is_favorite ? -1 : 1;
        }

        const rightTimestamp = Date.parse(right.created_at);
        const leftTimestamp = Date.parse(left.created_at);
        return rightTimestamp - leftTimestamp;
      });
  }

  const workspaceNameById = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const boardsByWorkspaceId = new Map<string, BoardSummary[]>();
  for (const board of boards) {
    const nextList = boardsByWorkspaceId.get(board.workspace_id) ?? [];
    nextList.push(board);
    boardsByWorkspaceId.set(board.workspace_id, nextList);
  }

  return {
    boardsByWorkspaceId,
    recentBoards: boards.slice(0, 4),
    roleByWorkspaceId,
    workspaceNameById,
    workspaces,
  };
}

function BoardTile({ board, href, label, paletteIndex }: BoardTileProps) {
  return (
    <Link
      className="group rounded-lg border border-slate-700 bg-[#242731] p-2.5 transition-colors hover:border-sky-400/70 hover:bg-[#2a2f3d]"
      href={href}
    >
      <div
        className={cn(
          "h-14 rounded-md bg-gradient-to-r",
          BOARD_GRADIENTS[paletteIndex % BOARD_GRADIENTS.length],
        )}
      />
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-100">{board.name}</p>
      <p className="line-clamp-1 text-xs text-slate-400">{label}</p>
    </Link>
  );
}

function EmptyBoardsState({ hasWorkspace }: { hasWorkspace: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-[#20232d] px-4 py-5 text-sm text-slate-300">
      {hasWorkspace
        ? "No boards yet. Use the Create new board tile in a workspace to add one."
        : "No workspace yet. Create your first workspace from the left panel."}
    </div>
  );
}

function RecentBoardsSection({
  recentBoards,
  workspaceNameById,
  workspaceSlugById,
  hasWorkspace,
}: {
  hasWorkspace: boolean;
  recentBoards: BoardSummary[];
  workspaceNameById: Map<string, string>;
  workspaceSlugById: Map<string, string>;
}) {
  return (
    <div className="space-y-3">
      <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Clock3 className="h-5 w-5 text-slate-400" />
        Đã xem gần đây
      </h1>
      {recentBoards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recentBoards.map((board, index) => (
            <BoardTile
              board={board}
              href={APP_ROUTES.workspace.boardById(workspaceSlugById.get(board.workspace_id) ?? "", board.id)}
              key={board.id}
              label={workspaceNameById.get(board.workspace_id) ?? "Workspace"}
              paletteIndex={index}
            />
          ))}
        </div>
      ) : (
        <EmptyBoardsState hasWorkspace={hasWorkspace} />
      )}
    </div>
  );
}

function StarredBoardsSection({
  starredBoards,
  workspaceNameById,
  workspaceSlugById,
}: {
  starredBoards: BoardSummary[];
  workspaceNameById: Map<string, string>;
  workspaceSlugById: Map<string, string>;
}) {
  if (starredBoards.length < 1) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Star className="h-5 w-5 text-slate-400" />
        Bảng Đánh Dấu Sao
      </h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {starredBoards.map((board, index) => (
          <BoardTile
            board={board}
            href={APP_ROUTES.workspace.boardById(workspaceSlugById.get(board.workspace_id) ?? "", board.id)}
            key={board.id}
            label={workspaceNameById.get(board.workspace_id) ?? "Workspace"}
            paletteIndex={index}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceBoardsSection({
  boardsByWorkspaceId,
  roleByWorkspaceId,
  selectedWorkspaceSlug,
  workspaces,
}: {
  boardsByWorkspaceId: Map<string, BoardSummary[]>;
  roleByWorkspaceId: Map<string, WorkspaceMembership["role"]>;
  selectedWorkspaceSlug?: string;
  workspaces: WorkspaceSummary[];
}) {
  const visibleWorkspaces = selectedWorkspaceSlug
    ? workspaces.filter((workspace) => workspace.slug === selectedWorkspaceSlug)
    : workspaces;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-300">Các không gian làm việc của bạn</h2>
      {visibleWorkspaces.length === 0 ? <EmptyBoardsState hasWorkspace={workspaces.length > 0} /> : null}
      {visibleWorkspaces.map((workspace, workspaceIndex) => {
        const workspaceBoards = boardsByWorkspaceId.get(workspace.id) ?? [];
        const openWorkspaceHref = workspaceBoards[0]
          ? APP_ROUTES.workspace.boardById(workspace.slug, workspaceBoards[0].id)
          : createBoardDialogHref(workspace.slug);

        return (
          <section className="space-y-2" key={workspace.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-700 text-xs font-semibold text-slate-100">
                  {workspace.name.slice(0, 1).toUpperCase()}
                </span>
                <p className="font-medium text-slate-100">{workspace.name}</p>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                  {roleByWorkspaceId.get(workspace.id) ?? "member"}
                </span>
              </div>
              <Link
                className="text-xs font-medium text-sky-300 hover:text-sky-200"
                href={openWorkspaceHref}
              >
                Open workspace
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {workspaceBoards.map((board, boardIndex) => (
                <BoardTile
                  board={board}
                  href={APP_ROUTES.workspace.boardById(workspace.slug, board.id)}
                  key={board.id}
                  label={board.description || "No description"}
                  paletteIndex={workspaceIndex + boardIndex}
                />
              ))}
              <Link
                className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-600 bg-[#202531] px-3 text-sm font-medium text-slate-300 transition-colors hover:border-sky-400 hover:text-sky-200"
                href={createBoardDialogHref(workspace.slug)}
              >
                Create new board
              </Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default async function WorkspaceIndexPage({ searchParams }: WorkspacePageProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const resolvedSearchParams = await resolveWorkspaceSearchParams(searchParams);
  const statusMessage = getFirstQueryParamValue(resolvedSearchParams.message);
  const statusMessageType = getFirstQueryParamValue(resolvedSearchParams.type);
  const shouldOpenCreateBoardModal = getFirstQueryParamValue(resolvedSearchParams.createBoard) === "1";
  const createBoardMessage = getFirstQueryParamValue(resolvedSearchParams.createBoardMessage);
  const createBoardType = getFirstQueryParamValue(resolvedSearchParams.createBoardType);
  const { boardsByWorkspaceId, recentBoards, roleByWorkspaceId, workspaceNameById, workspaces } =
    await getWorkspaceDashboardData(supabase, user.id);
  const firstWorkspaceSlug = workspaces[0]?.slug;
  const requestedWorkspaceSlug = getFirstQueryParamValue(resolvedSearchParams.workspace);
  const availableWorkspaceSlugs = new Set(workspaces.map((workspace) => workspace.slug));
  const selectedWorkspaceSlug =
    requestedWorkspaceSlug && availableWorkspaceSlugs.has(requestedWorkspaceSlug)
      ? requestedWorkspaceSlug
      : firstWorkspaceSlug;
  const workspaceSlugById = new Map(workspaces.map((workspace) => [workspace.id, workspace.slug]));
  const starredBoards = Array.from(boardsByWorkspaceId.values())
    .flat()
    .filter((board) => board.is_favorite);
  const manageInvitesHref = selectedWorkspaceSlug
    ? APP_ROUTES.workspace.invitesBySlug(selectedWorkspaceSlug)
    : APP_ROUTES.workspace.invites;

  return (
    <>
      <div className="grid gap-4 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <WorkspaceSidebar
          activeWorkspaceSlug={selectedWorkspaceSlug}
          messageType={statusMessageType}
          statusMessage={statusMessage}
          workspaces={workspaces}
        />

        <section className="space-y-5 rounded-xl border border-slate-800 bg-[#161a23] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1f222d] p-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Invites moved</p>
              <p className="text-xs text-slate-400">Manage collaborator invitations in the dedicated invite page.</p>
            </div>
            <Link href={manageInvitesHref}>
              <Button className="min-h-10" type="button">
                Manage invites
              </Button>
            </Link>
          </div>
          <StarredBoardsSection
            starredBoards={starredBoards}
            workspaceNameById={workspaceNameById}
            workspaceSlugById={workspaceSlugById}
          />
          <RecentBoardsSection
            hasWorkspace={workspaces.length > 0}
            recentBoards={recentBoards}
            workspaceNameById={workspaceNameById}
            workspaceSlugById={workspaceSlugById}
          />
          <WorkspaceBoardsSection
            boardsByWorkspaceId={boardsByWorkspaceId}
            roleByWorkspaceId={roleByWorkspaceId}
            selectedWorkspaceSlug={selectedWorkspaceSlug}
            workspaces={workspaces}
          />
        </section>
      </div>

      <CreateBoardModal
        createBoardMessage={createBoardMessage}
        createBoardType={createBoardType}
        defaultWorkspaceSlug={selectedWorkspaceSlug}
        isOpen={shouldOpenCreateBoardModal}
        workspaceOptions={workspaces}
      />
    </>
  );
}
