"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlignLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui";

import { updateCardDescriptionInline } from "../actions.card-modal";
import type { CardRecord } from "../types";
import { safeBoardSnapshotPatch, updateCardDescriptionInSnapshot } from "./board-mutations/cache";
import { invalidateCardRichnessQuery } from "./board-mutations/invalidation";
import { boardSnapshotKey } from "./board-mutations/keys";
import { CardDescriptionEditor } from "./card-description-editor";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { descriptionToPlainText } from "./card-ui-utils";

type DescriptionSectionProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  workspaceSlug: string;
};

type SaveState = "error" | "idle" | "saved";

function readDraftFromStorage(storageKey: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const draft = window.localStorage.getItem(storageKey);
  if (typeof draft !== "string") {
    return null;
  }

  return draft;
}

function resolveSaveMessage({
  canWrite,
  hasUnsavedChanges,
  isSaving,
  lastSaveResult,
}: {
  canWrite: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSaveResult: SaveState;
}) {
  if (!canWrite) {
    return "Chế độ chỉ xem.";
  }
  if (isSaving) {
    return "Đang lưu mô tả...";
  }
  if (hasUnsavedChanges) {
    return "Bản nháp chưa lưu.";
  }
  if (lastSaveResult === "saved") {
    return "Đã lưu.";
  }
  if (lastSaveResult === "error") {
    return "Lưu thất bại. Vui lòng thử lại.";
  }
  return "Nhấn vào mô tả để chỉnh sửa.";
}

function CollapsedDescriptionSurface({
  canWrite,
  onOpenEditor,
  previewText,
}: {
  canWrite: boolean;
  onOpenEditor: () => void;
  previewText: string;
}) {
  return (
    <button
      className="min-h-24 w-full rounded-md border border-slate-600 bg-transparent px-4 py-3 text-left text-base text-slate-100 transition hover:border-slate-500 focus:outline-none focus-visible:border-slate-400"
      disabled={!canWrite}
      onClick={onOpenEditor}
      type="button"
    >
      {previewText.length > 0 ? (
        <p className="whitespace-pre-wrap leading-6 text-slate-100">{previewText}</p>
      ) : (
        <p className="text-slate-400">Thêm mô tả chi tiết hơn...</p>
      )}
    </button>
  );
}

function DescriptionActionBar({
  canWrite,
  hasUnsavedChanges,
  isSaving,
  onCancel,
  onSave,
}: {
  canWrite: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWrite ? (
        <>
          <Button
            className="h-10 bg-[#0c66e4] px-4 text-white hover:bg-[#0055cc]"
            disabled={isSaving || !hasUnsavedChanges}
            onClick={onSave}
            type="button"
          >
            Lưu
          </Button>
          <Button
            className="h-10 border-slate-600 bg-white/10 px-4 text-slate-100 hover:bg-white/15"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            Hủy
          </Button>
        </>
      ) : null}
      <button
        className="ml-auto inline-flex h-10 items-center rounded-md border border-slate-600 bg-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/15"
        onClick={() => {
          window.open("https://www.markdownguide.org/basic-syntax/", "_blank", "noopener,noreferrer");
        }}
        type="button"
      >
        Trợ giúp định dạng
      </button>
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardRichnessDescriptionSection({
  boardId,
  canWrite,
  card,
  workspaceSlug,
}: DescriptionSectionProps) {
  const queryClient = useQueryClient();
  const initialDescription = card.description ?? "";
  const draftStorageKey = useMemo(
    () => `board:${workspaceSlug}:${boardId}:card:${card.id}:description-draft`,
    [boardId, card.id, workspaceSlug],
  );
  const restoredDescriptionDraft = useMemo(
    () => readDraftFromStorage(draftStorageKey),
    [draftStorageKey],
  );
  const initialDraft = restoredDescriptionDraft ?? initialDescription;
  const [descriptionDraft, setDescriptionDraft] = useState(initialDraft);
  const [persistedDescription, setPersistedDescription] = useState(initialDescription);
  const [isEditing, setIsEditing] = useState(
    restoredDescriptionDraft !== null && restoredDescriptionDraft !== initialDescription,
  );
  const [lastSaveResult, setLastSaveResult] = useState<SaveState>("idle");
  const draftRef = useRef(initialDraft);
  const saveRequestIdRef = useRef(0);
  const hasUnsavedChanges = descriptionDraft !== persistedDescription;
  const descriptionPreview = descriptionToPlainText(descriptionDraft).trim();
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const snapshotQueryKey = boardSnapshotKey({
    boardId,
    workspaceSlug,
  });
  const invalidateRichness = () => invalidateCardRichnessQuery({
    boardId,
    cardId: card.id,
    queryClient,
    workspaceSlug,
  });
  const saveMutation = useMutation({
    mutationKey: [...modalMutationKey, "description"],
    mutationFn: async (payload: { description: string; requestId: number }) => {
      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("workspaceSlug", workspaceSlug);
      formData.set("cardId", card.id);
      formData.set("description", payload.description);
      const result = await updateCardDescriptionInline(formData);
      return { payload, result };
    },
    onSuccess: ({ payload, result }) => {
      if (payload.requestId !== saveRequestIdRef.current) {
        return;
      }

      if (!result.ok) {
        setLastSaveResult("error");
        toast.error(result.error ?? "Không thể lưu mô tả.");
        return;
      }

      setPersistedDescription(payload.description);
      setDescriptionDraft(payload.description);
      draftRef.current = payload.description;
      setLastSaveResult("saved");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftStorageKey);
      }
      safeBoardSnapshotPatch(queryClient, snapshotQueryKey, (snapshot) => updateCardDescriptionInSnapshot({
        cardId: card.id,
        description: payload.description.length > 0 ? payload.description : null,
        snapshot,
      }));
      invalidateRichness();
      toast.success("Đã lưu mô tả.");
    },
    onError: () => {
      setLastSaveResult("error");
      toast.error("Không thể lưu mô tả.");
    },
  });
  const isSaving = saveMutation.isPending;

  const persistDescription = useCallback(
    (nextDescription: string) => {
      if (!canWrite || saveMutation.isPending) {
        return;
      }

      if (nextDescription === persistedDescription) {
        setLastSaveResult("saved");
        return;
      }

      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      setLastSaveResult("idle");
      saveMutation.mutate({ description: nextDescription, requestId });
    },
    [canWrite, persistedDescription, saveMutation],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasUnsavedChanges) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }

    window.localStorage.setItem(draftStorageKey, descriptionDraft);
  }, [descriptionDraft, draftStorageKey, hasUnsavedChanges]);

  useEffect(() => {
    if (!canWrite || (!hasUnsavedChanges && !isSaving)) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [canWrite, hasUnsavedChanges, isSaving]);

  const handleCancelEditing = useCallback(() => {
    draftRef.current = persistedDescription;
    setDescriptionDraft(persistedDescription);
    setIsEditing(false);
    setLastSaveResult("idle");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, persistedDescription]);

  const handleSaveDescription = useCallback(() => {
    persistDescription(draftRef.current);
  }, [persistDescription]);

  return (
    <section className="space-y-3">
      <p className="inline-flex items-center gap-2 text-[31px] font-semibold text-slate-200">
        <AlignLeft className="h-4 w-4" />
        Mô tả
      </p>

      {isEditing ? (
        <div className="space-y-3">
          <CardDescriptionEditor
            canWrite={canWrite}
            onChange={(nextValue) => {
              draftRef.current = nextValue;
              setDescriptionDraft(nextValue);
              if (nextValue !== persistedDescription) {
                setLastSaveResult("idle");
              }
            }}
            onRequestCancel={handleCancelEditing}
            onRequestSave={handleSaveDescription}
            value={descriptionDraft}
          />
          <DescriptionActionBar
            canWrite={canWrite}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            onCancel={handleCancelEditing}
            onSave={handleSaveDescription}
          />
        </div>
      ) : (
        <CollapsedDescriptionSurface
          canWrite={canWrite}
          onOpenEditor={() => setIsEditing(true)}
          previewText={descriptionPreview}
        />
      )}

      <p className="text-xs text-slate-400">
        {resolveSaveMessage({ canWrite, hasUnsavedChanges, isSaving, lastSaveResult })}
      </p>
    </section>
  );
}
