"use client";
/* eslint-disable max-lines */

import { motion } from "framer-motion";
import { useIsMutating } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui";

import type {
  CardRecord,
  LabelRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "../types";
import type { CardCopySummary } from "./card-copy-options-dialog";
import { CardAttachmentsSection } from "./card-richness-attachments";
import {
  buildChecklistToggleMutationKey,
  CardRichnessChecklistSection,
} from "./card-richness-checklist-section";
import { CardRichnessCommentsSection } from "./card-richness-comments-section";
import {
  buildCardChecklistQueryKey,
  buildCardRichnessQueryKey,
  buildChecklistDataFromRichnessSnapshot,
  buildRichnessSnapshotFromCard,
  CardRichnessError,
  CardRichnessLoading,
  EMPTY_CARD_RICHNESS,
  useCardChecklistQuery,
  useCardRichnessQuery,
} from "./card-richness-loader";
import {
  CardCustomFieldsSection,
  type CardCustomFieldsOptimisticPatch,
  ModalLabelStrip,
  QuickActionChips,
  TopBar,
  UtilityBar,
} from "./card-richness-modern-ui";
import { CardRichnessDescriptionSection } from "./card-richness-description-section";
import { CardModalContainer, useMobileSheetBreakpoint } from "./card-richness-modal-shell";
import { CardTitleRow } from "./card-title-row";
import type { QuickPanel } from "./card-quick-panel";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { SidebarActions } from "./card-richness-sidebar";
import type { BoardOptimisticChange } from "./board-dnd-helpers";

type CardPresenceEditor = {
  avatarUrl: string | null;
  colorClass: string;
  displayName: string;
  userId: string;
};

type CardRichnessPanelProps = {
  activeEditors?: CardPresenceEditor[];
  boardId: string;
  boardName: string;
  canWrite: boolean;
  card: CardRecord;
  isOpen: boolean;
  listOptions: Array<{ id: string; title: string }>;
  membershipRole: WorkspaceRole;
  onClose: () => void;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onToggleComplete?: (nextIsCompleted: boolean) => void;
  onOptimisticCustomFieldsChange?: (patch: CardCustomFieldsOptimisticPatch) => void;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

type CardModalBodyProps = {
  boardId: string;
  boardName: string;
  canManageAllComments: boolean;
  canManageLabels: boolean;
  canWrite: boolean;
  card: CardRecord;
  checklistHasLoadingError: boolean;
  checklistIsLoading: boolean;
  checklistQueryKey: ReturnType<typeof buildCardChecklistQueryKey>;
  checklists: typeof EMPTY_CARD_RICHNESS.checklists;
  hasLoadingError: boolean;
  isClosingSync: boolean;
  isInitialLoading: boolean;
  listOptions: Array<{ id: string; title: string }>;
  onOptimisticBoardChange: (change: BoardOptimisticChange) => () => void;
  onRichnessRefresh: () => Promise<void>;
  richnessQueryKey: ReturnType<typeof buildCardRichnessQueryKey>;
  onChecklistRefresh: () => Promise<void>;
  onClose: () => void;
  onOptimisticTitleChange?: (nextTitle: string) => void;
  onToggleComplete?: (nextIsCompleted: boolean) => void;
  pendingMutationCount: number;
  onOptimisticCustomFieldsChange?: (patch: CardCustomFieldsOptimisticPatch) => void;
  resolvedSnapshot: typeof EMPTY_CARD_RICHNESS;
  viewerId: string;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
};

function ActivePanelContent({
  activePanel,
  boardId,
  canManageAllComments,
  canManageLabels,
  canWrite,
  card,
  hasLoadingError,
  isInitialLoading,
  listOptions,
  onOptimisticBoardChange,
  onOptimisticCustomFieldsChange,
  onClose,
  onRichnessRefresh,
  richnessQueryKey,
  resolvedSnapshot,
  viewerId,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: {
  activePanel: QuickPanel;
} & Omit<CardModalBodyProps, "boardName" | "checklistHasLoadingError" | "checklistIsLoading" | "checklistQueryKey" | "checklists" | "isClosingSync" | "onChecklistRefresh" | "pendingMutationCount">) {
  const shouldRenderPanelDetails = Boolean(activePanel && activePanel !== "checklist");
  const hasAttachments = resolvedSnapshot.attachments.length > 0;

  if (isInitialLoading) {
    return <CardRichnessLoading />;
  }

  if (hasLoadingError) {
    return <CardRichnessError message="Không thể tải dữ liệu chi tiết thẻ." onRetry={() => {
      void onRichnessRefresh();
    }} />;
  }

  if (!shouldRenderPanelDetails && !hasAttachments) {
    return null;
  }

  return (
    <div className="space-y-4">
      {shouldRenderPanelDetails ? (
        <CardRichnessCommentsSection
          boardId={boardId}
          canManageAllComments={canManageAllComments}
          canWrite={canWrite}
          cardId={card.id}
          comments={resolvedSnapshot.comments}
          richnessQueryKey={richnessQueryKey}
          viewerId={viewerId}
          workspaceMembers={workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
      ) : null}
      {hasAttachments ? (
        <CardAttachmentsSection
          attachments={resolvedSnapshot.attachments}
          boardId={boardId}
          canManageAllAttachments={canManageLabels}
          canWrite={canWrite}
          cardId={card.id}
          richnessQueryKey={richnessQueryKey}
          viewerId={viewerId}
          workspaceSlug={workspaceSlug}
        />
      ) : null}
      {shouldRenderPanelDetails ? (
        <SidebarActions
          boardId={boardId}
          canWrite={canWrite}
          card={card}
          listOptions={listOptions}
          onCloseAfterDestructive={onClose}
          onOptimisticBoardChange={onOptimisticBoardChange}
          onOptimisticCardPatch={onOptimisticCustomFieldsChange}
          richnessQueryKey={richnessQueryKey}
          workspaceSlug={workspaceSlug}
        />
      ) : null}
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
function CardModalBody({
  boardId,
  boardName,
  canManageAllComments,
  canManageLabels,
  canWrite,
  card,
  checklistHasLoadingError,
  checklistIsLoading,
  checklistQueryKey,
  checklists,
  hasLoadingError,
  isClosingSync,
  isInitialLoading,
  listOptions,
  onOptimisticBoardChange,
  onRichnessRefresh,
  richnessQueryKey,
  onChecklistRefresh,
  onClose,
  onOptimisticTitleChange,
  onToggleComplete,
  pendingMutationCount,
  onOptimisticCustomFieldsChange,
  resolvedSnapshot,
  viewerId,
  workspaceLabels,
  workspaceMembers,
  workspaceSlug,
}: CardModalBodyProps) {
  const [activePanel, setActivePanel] = useState<QuickPanel>(null);
  const shouldRenderChecklist = checklists.length > 0 || activePanel === "checklist";
  const customFieldCount = [card.status, card.priority, card.effort].reduce((count, value) => {
    if (typeof value !== "string") {
      return count;
    }
    return value.trim().length > 0 ? count + 1 : count;
  }, 0);
  const copySummary: CardCopySummary = {
    attachmentCount: resolvedSnapshot.attachments.length > 0 ? resolvedSnapshot.attachments.length : (card.attachmentCount ?? 0),
    checklistCount: resolvedSnapshot.checklists.length > 0 ? resolvedSnapshot.checklists.length : (card.checklistTotalCount ?? 0),
    customFieldCount,
    memberCount: card.assignees.length,
  };

  useEffect(() => {
    if (activePanel !== "checklist") {
      return;
    }

    void onChecklistRefresh();
  }, [activePanel, onChecklistRefresh]);

  return (
    <div className="space-y-6 px-6 py-5" key={card.id}>
      <TopBar
        boardId={boardId}
        boardName={boardName}
        canWrite={canWrite}
        card={card}
        copySummary={copySummary}
        listOptions={listOptions}
        onClose={onClose}
        onOptimisticBoardChange={onOptimisticBoardChange}
        onOptimisticCardPatch={onOptimisticCustomFieldsChange}
        richnessQueryKey={richnessQueryKey}
        workspaceSlug={workspaceSlug}
      />

      <div className="space-y-4 border-t border-white/10 pt-5">
        <CardTitleRow
          boardId={boardId}
          canWrite={canWrite}
          card={card}
          onOptimisticTitleChange={onOptimisticTitleChange}
          onToggleComplete={onToggleComplete}
          workspaceSlug={workspaceSlug}
        />
        <QuickActionChips
          activePanel={activePanel}
          boardId={boardId}
          card={card}
          canManageLabels={canManageLabels}
          canWrite={canWrite}
          labels={card.labels}
          onOptimisticLabelsChange={(nextLabels) => {
            onOptimisticCustomFieldsChange?.({ labels: nextLabels });
          }}
          onOptimisticCardPatch={onOptimisticCustomFieldsChange}
          onChecklistCreated={async () => {
            await Promise.all([onRichnessRefresh(), onChecklistRefresh()]);
          }}
          onSelectPanel={setActivePanel}
          richnessQueryKey={richnessQueryKey}
          workspaceLabels={workspaceLabels}
          workspaceMembers={workspaceMembers}
          workspaceSlug={workspaceSlug}
        />
        <ModalLabelStrip
          canWrite={canWrite}
          labels={card.labels}
          onOpenLabelsPanel={() => {
            setActivePanel("labels");
          }}
        />
      </div>

      <CardRichnessDescriptionSection
        boardId={boardId}
        canWrite={canWrite}
        card={card}
        key={`description:${card.id}`}
        workspaceSlug={workspaceSlug}
      />

      <CardCustomFieldsSection
        boardId={boardId}
        canWrite={canWrite}
        card={card}
        key={`custom-fields:${card.id}`}
        onOptimisticCustomFieldsChange={onOptimisticCustomFieldsChange}
        workspaceSlug={workspaceSlug}
      />

      {shouldRenderChecklist ? (
        checklistIsLoading ? (
          <CardRichnessLoading />
        ) : checklistHasLoadingError ? (
          <CardRichnessError
            message="Không thể tải dữ liệu chi tiết thẻ."
            onRetry={() => {
              void onChecklistRefresh();
            }}
          />
        ) : (
          <CardRichnessChecklistSection
            boardId={boardId}
            cardId={card.id}
            canWrite={canWrite}
            checklistQueryKey={checklistQueryKey}
            checklists={checklists}
            workspaceSlug={workspaceSlug}
          />
        )
      ) : null}

      {isClosingSync ? (
        <p className="rounded-md border border-cyan-700/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
          Đang đồng bộ thay đổi{pendingMutationCount > 0 ? ` (${pendingMutationCount})` : ""}...
        </p>
      ) : null}

      <ActivePanelContent
        activePanel={activePanel}
        boardId={boardId}
        canManageAllComments={canManageAllComments}
        canManageLabels={canManageLabels}
        canWrite={canWrite}
        card={card}
        hasLoadingError={hasLoadingError}
        isInitialLoading={isInitialLoading}
        listOptions={listOptions}
        onClose={onClose}
        onOptimisticBoardChange={onOptimisticBoardChange}
        onOptimisticCustomFieldsChange={onOptimisticCustomFieldsChange}
        onRichnessRefresh={onRichnessRefresh}
        richnessQueryKey={richnessQueryKey}
        resolvedSnapshot={resolvedSnapshot}
        viewerId={viewerId}
        workspaceLabels={workspaceLabels}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspaceSlug}
      />

      <UtilityBar />
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardRichnessPanel(props: CardRichnessPanelProps) {
  const {
    boardId,
    boardName,
    canWrite,
    card,
    isOpen,
    listOptions,
    membershipRole,
    onClose,
    onOptimisticTitleChange,
    onOptimisticBoardChange,
    onToggleComplete,
    onOptimisticCustomFieldsChange,
    viewerId,
    workspaceLabels,
    workspaceMembers,
    workspaceSlug,
  } = props;
  const canManageLabels = canWrite && (membershipRole === "owner" || membershipRole === "admin");
  const canManageAllComments = canManageLabels;
  const [isClosingSync, setIsClosingSync] = useState(false);
  const closeRequestedRef = useRef(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPendingChecklistMutationCountRef = useRef(0);
  const pendingChecklistMutationCount = useIsMutating({
    mutationKey: buildChecklistToggleMutationKey({
      boardId,
      cardId: card.id,
      workspaceSlug,
    }),
  });
  const pendingModalMutationCount = useIsMutating({
    mutationKey: buildCardModalMutationKey({
      boardId,
      cardId: card.id,
      workspaceSlug,
    }),
  });
  const pendingMutationCount = pendingChecklistMutationCount + pendingModalMutationCount;
  const cardSnapshotSeed = buildRichnessSnapshotFromCard(card);
  const richnessQueryKey = buildCardRichnessQueryKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const {
    data: richnessSnapshot,
    isError: richnessHasLoadingError,
    isLoading: isRichnessLoading,
    refetch: refetchRichness,
  } = useCardRichnessQuery({
    boardId,
    cardId: card.id,
    enabled: isOpen,
    initialData: cardSnapshotSeed,
    workspaceSlug,
  });
  const checklistQueryKey = buildCardChecklistQueryKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const {
    data: checklistQueryData,
    isError: checklistHasLoadingError,
    isLoading: isChecklistLoading,
    refetch: refetchChecklist,
  } = useCardChecklistQuery({
    boardId,
    cardId: card.id,
    enabled: isOpen,
    initialData: buildChecklistDataFromRichnessSnapshot(cardSnapshotSeed),
    workspaceSlug,
  });
  const isMobileSheet = useMobileSheetBreakpoint();
  const CLOSE_SYNC_TIMEOUT_MS = 300;

  const finalizeClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    closeRequestedRef.current = false;
    setIsClosingSync(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (pendingMutationCount < 1) {
      finalizeClose();
      return;
    }

    if (closeRequestedRef.current) {
      return;
    }

    closeRequestedRef.current = true;
    setIsClosingSync(true);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      if (!closeRequestedRef.current) {
        return;
      }
      finalizeClose();
    }, CLOSE_SYNC_TIMEOUT_MS);
  }, [finalizeClose, pendingMutationCount]);

  useEffect(() => {
    if (!closeRequestedRef.current || pendingMutationCount > 0) {
      return;
    }

    const closeTimer = window.setTimeout(() => {
      finalizeClose();
    }, 0);
    return () => {
      window.clearTimeout(closeTimer);
    };
  }, [finalizeClose, pendingMutationCount]);

  useEffect(() => {
    if (!isOpen) {
      previousPendingChecklistMutationCountRef.current = pendingMutationCount;
      return;
    }

    const previousPending = previousPendingChecklistMutationCountRef.current;
    if (previousPending > 0 && pendingMutationCount < 1) {
      void refetchChecklist();
    }
    previousPendingChecklistMutationCountRef.current = pendingMutationCount;
  }, [isOpen, pendingMutationCount, refetchChecklist]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const resolvedSnapshot = richnessSnapshot ?? cardSnapshotSeed ?? EMPTY_CARD_RICHNESS;
  const checklistSnapshot = checklistQueryData?.checklists ?? cardSnapshotSeed.checklists;
  const hasSeedSnapshotData =
    cardSnapshotSeed.assignees.length > 0 ||
    cardSnapshotSeed.labels.length > 0 ||
    cardSnapshotSeed.attachments.length > 0 ||
    cardSnapshotSeed.comments.length > 0 ||
    cardSnapshotSeed.checklists.length > 0 ||
    (card.description?.trim().length ?? 0) > 0 ||
    (card.commentCount ?? 0) > 0 ||
    (card.attachmentCount ?? 0) > 0 ||
    (card.checklistTotalCount ?? 0) > 0;
  const isInitialLoading = isRichnessLoading && !richnessSnapshot && !hasSeedSnapshotData;
  const hasLoadingError = richnessHasLoadingError && !richnessSnapshot && !hasSeedSnapshotData;
  const checklistIsLoading = isChecklistLoading && checklistQueryData === undefined;

  const cardModalBody = (
    <CardModalBody
      boardId={boardId}
      boardName={boardName}
      canManageAllComments={canManageAllComments}
      canManageLabels={canManageLabels}
      canWrite={canWrite}
      card={card}
      checklistHasLoadingError={checklistHasLoadingError}
      checklistIsLoading={checklistIsLoading}
      checklistQueryKey={checklistQueryKey}
      checklists={checklistSnapshot}
      key={card.id}
      hasLoadingError={hasLoadingError}
      isClosingSync={isClosingSync}
      isInitialLoading={isInitialLoading}
      listOptions={listOptions}
      onRichnessRefresh={async () => {
        await refetchRichness();
      }}
      richnessQueryKey={richnessQueryKey}
      onChecklistRefresh={async () => {
        await refetchChecklist();
      }}
      onClose={requestClose}
      onOptimisticTitleChange={onOptimisticTitleChange}
      onOptimisticBoardChange={onOptimisticBoardChange}
      onToggleComplete={onToggleComplete}
      pendingMutationCount={pendingMutationCount}
      onOptimisticCustomFieldsChange={onOptimisticCustomFieldsChange}
      resolvedSnapshot={resolvedSnapshot}
      viewerId={viewerId}
      workspaceLabels={workspaceLabels}
      workspaceMembers={workspaceMembers}
      workspaceSlug={workspaceSlug}
    />
  );

  return (
    <CardModalContainer
      cardTitle={card.title}
      isMobile={isMobileSheet}
      isOpen={isOpen}
      onClose={requestClose}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full min-h-0 flex-col"
        initial={{ opacity: 0, scale: 0.985, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {isMobileSheet ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">{cardModalBody}</div>
        ) : (
          <ScrollArea className="min-h-0 flex-1" showVerticalScrollbar>
            {cardModalBody}
          </ScrollArea>
        )}
      </motion.div>
    </CardModalContainer>
  );
}
