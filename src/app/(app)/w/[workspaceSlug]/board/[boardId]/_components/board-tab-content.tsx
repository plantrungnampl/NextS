"use client";

import Link from "next/link";
import { Globe, Inbox, ListTodo, Lock, Mail, MessageSquare, Mic, Paperclip } from "lucide-react";
import { Suspense } from "react";

import { APP_ROUTES } from "@/core";

import type {
  BoardSettings,
  BoardViewer,
  CardRecord,
  LabelRecord,
  ListWithCards,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";
import { BoardBottomDock } from "./board-bottom-dock";
import { type BoardDockState } from "./board-dock-state";
import { BoardDndCanvas } from "./board-dnd-canvas";
import { useBoardInboxQuery } from "./board-inbox-query";
import { useBoardViewState } from "./board-view-state";

type BoardTabContentProps = {
  boardId: string;
  boardName: string;
  initialBoardVersion: number;
  initialBoardSettings: BoardSettings;
  initialDockState: BoardDockState;
  initialLists: ListWithCards[];
  initialPrivateInboxCards: CardRecord[];
  canWriteBoard: boolean;
  membershipRole: WorkspaceRole;
  statusMessage: string | null;
  statusType: "error" | "success" | null;
  viewer: BoardViewer;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function InboxCardTile({
  boardId,
  card,
  workspaceSlug,
}: {
  boardId: string;
  card: CardRecord;
  workspaceSlug: string;
}) {
  const cardHref = `${APP_ROUTES.workspace.boardById(workspaceSlug, boardId)}?views=inbox,info&c=${encodeURIComponent(card.id)}`;

  return (
    <Link
      className="block rounded-md border border-white/10 bg-[#1d2f4f] px-3 py-2 transition-colors hover:bg-[#22385d]"
      href={cardHref}
    >
      <p className="line-clamp-1 text-sm font-semibold text-slate-100">{card.title}</p>
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-300">
        <span className="inline-flex items-center gap-1">
          <ListTodo className="h-3 w-3" />
          {card.checklistCompletedCount ?? 0}/{card.checklistTotalCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {card.commentCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" />
          {card.attachmentCount ?? 0}
        </span>
      </div>
    </Link>
  );
}

function InboxSidebar({
  boardId,
  inboxCards,
  isRefreshing,
  workspaceSlug,
}: {
  boardId: string;
  inboxCards: CardRecord[];
  isRefreshing: boolean;
  workspaceSlug: string;
}) {
  const shouldShowInboxSummary = inboxCards.length < 1;

  return (
    <aside className="flex h-[calc(100dvh-12rem)] min-h-[440px] flex-col rounded-xl border border-[#2f4f7a] bg-[#15335e]/95 p-3 text-slate-100 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-sky-200" />
        <h2 className="text-lg font-semibold text-slate-100">Hộp thư đến</h2>
        {isRefreshing ? <span className="text-[10px] text-sky-200">Đang cập nhật...</span> : null}
      </div>
      <div className="mt-3 space-y-2">
        <button
          className="inline-flex h-9 w-full items-center rounded-md border border-white/5 bg-[#2a3443] px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-[#323f52]"
          disabled
          type="button"
        >
          Thêm thẻ
        </button>
        <p className="text-xs text-slate-300">Xem, gửi, lưu lại để dùng sau</p>
      </div>

      {shouldShowInboxSummary ? (
        <div className="mt-4 rounded-xl border border-[#2a4b79] bg-[#183965] px-3 py-4 text-center">
          <p className="text-2xl font-semibold leading-tight text-slate-100">Tổng hợp việc cần làm</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Gửi email, dùng giọng nói, chuyển tiếp nhanh chóng đưa vào hộp thư đến theo cách của bạn.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/40 bg-[#0d2749] text-sky-300">
              <Mail className="h-5 w-5" />
            </span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/40 bg-[#0d2749] text-emerald-300">
              <Mic className="h-5 w-5" />
            </span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/40 bg-[#0d2749] text-amber-300">
              <Globe className="h-5 w-5" />
            </span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-violet-400/40 bg-[#0d2749] text-violet-300">
              <MessageSquare className="h-5 w-5" />
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 overflow-y-auto pr-1">
          {inboxCards.map((card) => (
            <InboxCardTile boardId={boardId} card={card} key={card.id} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      )}

      <p className="mt-auto pt-3 text-center text-xs text-slate-300">
        <Lock className="mr-1 inline h-3.5 w-3.5 align-[-1px]" />
        Chỉ mình bạn có thể thấy Hộp thư đến
      </p>
    </aside>
  );
}

// eslint-disable-next-line max-lines-per-function
export function BoardTabContent({
  boardId,
  boardName,
  initialBoardVersion,
  initialBoardSettings,
  initialDockState,
  initialLists,
  initialPrivateInboxCards,
  canWriteBoard,
  membershipRole,
  statusMessage,
  statusType,
  viewer,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: BoardTabContentProps) {
  const { setByDockItem, state } = useBoardViewState(initialDockState);
  const isReadOnlyBoard = !canWriteBoard;
  const shouldShowInboxRail = !state.exclusive && state.inbox;
  const shouldShowInfoCanvas = state.exclusive
    ? state.exclusive !== "planner"
    : state.info;
  const shouldShowPlannerRail = state.exclusive === "planner";

  const inboxQuery = useBoardInboxQuery({
    boardId,
    enabled: shouldShowInboxRail,
    initialData: initialPrivateInboxCards,
    workspaceSlug,
  });
  const inboxCards = inboxQuery.data ?? initialPrivateInboxCards;

  const messageNode = statusMessage ? (
    <p
      className={
        statusType === "success"
          ? "rounded-md border border-emerald-300/70 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100"
          : "rounded-md border border-rose-300/70 bg-rose-950/35 px-3 py-2 text-sm text-rose-100"
      }
      role="alert"
    >
      {statusMessage}
    </p>
  ) : null;

  const boardCanvas = (
    <Suspense fallback={<div className="h-[60vh] rounded-2xl border border-white/10 bg-slate-950/40" />}>
      <BoardDndCanvas
        boardId={boardId}
        boardName={boardName}
        initialBoardSettings={initialBoardSettings}
        initialBoardVersion={initialBoardVersion}
        initialLists={initialLists}
        canWriteBoard={canWriteBoard}
        membershipRole={membershipRole}
        viewer={viewer}
        workspaceLabels={workspaceLabels}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspaceSlug}
      />
    </Suspense>
  );

  return (
    <>
      {shouldShowPlannerRail ? (
        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-white/15 bg-gray-900/50 p-3 text-slate-100 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Board companion</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">Planner</h2>
            <p className="mt-1 text-sm text-slate-300">
              Connect your weekly plan and keep project execution aligned with sprint priorities.
            </p>
            <button
              className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-cyan-400 px-3 text-sm font-semibold text-[#072025] transition-colors hover:bg-cyan-300"
              type="button"
            >
              Connect calendar
            </button>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Week overview</p>
              <div className="mt-3 flex items-end gap-1.5">
                <div className="h-7 w-5 rounded-sm bg-emerald-400/70" />
                <div className="h-5 w-5 rounded-sm bg-sky-400/65" />
                <div className="h-8 w-5 rounded-sm bg-violet-400/70" />
                <div className="h-4 w-5 rounded-sm bg-amber-400/70" />
                <div className="h-9 w-5 rounded-sm bg-cyan-300/70" />
              </div>
            </div>
            {isReadOnlyBoard ? (
              <p className="mt-4 rounded-lg border border-amber-300/35 bg-amber-900/20 px-3 py-2 text-xs text-amber-100">
                You are viewing this board in read-only mode.
              </p>
            ) : null}
          </aside>

          <div className="space-y-2">
            {messageNode}
            {boardCanvas}
          </div>
        </div>
      ) : shouldShowInboxRail && shouldShowInfoCanvas ? (
        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <InboxSidebar
            boardId={boardId}
            inboxCards={inboxCards}
            isRefreshing={inboxQuery.isFetching}
            workspaceSlug={workspaceSlug}
          />
          <div className="space-y-2">
            {isReadOnlyBoard ? (
              <p className="rounded-xl border border-slate-500/35 bg-slate-900/45 px-3 py-2 text-xs text-slate-200">
                Public board. You have read-only access.
              </p>
            ) : null}
            {messageNode}
            {boardCanvas}
          </div>
        </div>
      ) : shouldShowInboxRail ? (
        <div className="space-y-2">
          {isReadOnlyBoard ? (
            <p className="rounded-xl border border-slate-500/35 bg-slate-900/45 px-3 py-2 text-xs text-slate-200">
              Public board. You have read-only access.
            </p>
          ) : null}
          {messageNode}
          <div className="max-w-[320px]">
            <InboxSidebar
              boardId={boardId}
              inboxCards={inboxCards}
              isRefreshing={inboxQuery.isFetching}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {isReadOnlyBoard ? (
            <p className="rounded-xl border border-slate-500/35 bg-slate-900/45 px-3 py-2 text-xs text-slate-200">
              Public board. You have read-only access.
            </p>
          ) : null}
          {messageNode}
          {boardCanvas}
        </div>
      )}
      <BoardBottomDock onSelect={setByDockItem} state={state} />
    </>
  );
}
