import { BoardTabContent } from "./_components/board-tab-content";
import { resolveBoardDockState } from "./_components/board-dock-state";
import { BoardHero } from "./_components/board-hero";
import { getBoardPageData } from "./data";

import { getFirstQueryParamValue, isPromise } from "@/shared";

type BoardPageProps = {
  params: Promise<{
    boardId: string;
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{
    message?: string | string[];
    type?: string | string[];
    view?: string | string[];
    views?: string | string[];
  }>;
};

async function resolveSearchParams(searchParams: BoardPageProps["searchParams"]) {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const { boardId, workspaceSlug } = await params;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const message = getFirstQueryParamValue(resolvedSearchParams.message) ?? null;
  const messageType = getFirstQueryParamValue(resolvedSearchParams.type);
  const boardDockState = resolveBoardDockState({
    viewParam: getFirstQueryParamValue(resolvedSearchParams.view),
    viewsParam: getFirstQueryParamValue(resolvedSearchParams.views),
  });

  const data = await getBoardPageData(workspaceSlug, boardId);
  const statusType = message
    ? (messageType === "success" ? "success" : "error")
    : null;

  return (
    <section className="relative isolate -mx-3 -my-3 h-[calc(100dvh-var(--app-header-height))] overflow-hidden bg-[#070b18] pb-20 sm:-mx-5 lg:-mx-6 md:pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3f1b6b] via-[#1f1d3a] to-[#0f4d4c]" />
        <div className="absolute -left-20 -top-20 h-[22rem] w-[22rem] rounded-full bg-[#8b3dff]/45 blur-[110px]" />
        <div className="absolute right-[-5rem] top-16 h-[24rem] w-[24rem] rounded-full bg-emerald-400/35 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-cyan-400/25 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.25),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(129,140,248,0.2),transparent_42%)]" />
      </div>

      <div className="relative z-10 space-y-3 p-2 md:p-3">
        <BoardHero
          board={data.board}
          canManageBoardAccess={data.canManageBoardAccess}
          canManageBoardSettings={data.canManageBoardSettings}
          canWriteBoard={data.canWriteBoard}
          role={data.membershipRole}
          visibility={data.board.visibility}
          viewer={data.viewer}
          workspaceName={data.workspace.name}
          workspaceLabels={data.workspaceLabels}
          workspaceMembers={data.workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
        <BoardTabContent
          boardId={data.board.id}
          boardName={data.board.name}
          initialBoardSettings={{
            commentPermission: data.board.commentPermission,
            editPermission: data.board.editPermission,
            memberManagePermission: data.board.memberManagePermission,
            showCardCoverOnFront: data.board.showCardCoverOnFront,
            showCompleteStatusOnFront: data.board.showCompleteStatusOnFront,
          }}
          initialBoardVersion={data.board.syncVersion}
          initialDockState={boardDockState}
          initialLists={data.listsWithCards}
          initialPrivateInboxCards={data.privateInboxCards}
          canCommentBoard={data.canCommentBoard}
          canWriteBoard={data.canWriteBoard}
          membershipRole={data.membershipRole}
          statusMessage={message}
          statusType={statusType}
          viewer={data.viewer}
          workspaceLabels={data.workspaceLabels}
          workspaceMembers={data.workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </section>
  );
}
