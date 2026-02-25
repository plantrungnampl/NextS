"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui";

import { updateCardCustomFieldsInline } from "../actions.card-modal";
import type { CardRecord, LabelRecord, WorkspaceMemberRecord } from "../types";
import { CardCustomFieldsInputs } from "./card-custom-fields-inputs";

type CustomFieldDraft = {
  effort: string;
  priority: string;
  status: string;
};

export type CardCustomFieldsOptimisticPatch = {
  assignees?: WorkspaceMemberRecord[];
  completed_at?: string | null;
  coverAttachmentId?: string | null;
  coverColor?: string | null;
  coverColorblindFriendly?: boolean;
  coverMode?: CardRecord["coverMode"];
  coverSize?: CardRecord["coverSize"];
  due_at?: string | null;
  effort?: string | null;
  has_due_time?: boolean;
  has_start_time?: boolean;
  is_completed?: boolean;
  is_template?: boolean;
  labels?: LabelRecord[];
  list_id?: string;
  priority?: string | null;
  recurrence_anchor_at?: string | null;
  recurrence_rrule?: string | null;
  recurrence_tz?: string | null;
  reminder_offset_minutes?: number | null;
  start_at?: string | null;
  status?: string | null;
  watchCount?: number;
  watchedByViewer?: boolean;
};

type CardCustomFieldsSectionProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  onOptimisticCustomFieldsChange?: (patch: CardCustomFieldsOptimisticPatch) => void;
  workspaceSlug: string;
};

function toDraftPayload(value: string | null | undefined): string {
  return value ?? "";
}

function buildDraftFromCard(card: CardRecord): CustomFieldDraft {
  return {
    effort: toDraftPayload(card.effort),
    priority: toDraftPayload(card.priority),
    status: toDraftPayload(card.status),
  };
}

function readStoredDraft(storageKey: string, fallbackDraft: CustomFieldDraft): CustomFieldDraft {
  if (typeof window === "undefined") {
    return fallbackDraft;
  }

  const storedDraft = window.localStorage.getItem(storageKey);
  if (!storedDraft) {
    return fallbackDraft;
  }

  try {
    const parsed = JSON.parse(storedDraft) as Partial<CustomFieldDraft>;
    return {
      effort: typeof parsed.effort === "string" ? parsed.effort : fallbackDraft.effort,
      priority: typeof parsed.priority === "string" ? parsed.priority : fallbackDraft.priority,
      status: typeof parsed.status === "string" ? parsed.status : fallbackDraft.status,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return fallbackDraft;
  }
}

function useAutosaveCustomFields(params: {
  boardId: string;
  canWrite: boolean;
  cardId: string;
  draftStorageKey: string;
  fieldDraft: CustomFieldDraft;
  hasUnsavedFieldChanges: boolean;
  onOptimisticCustomFieldsChange?: (patch: CardCustomFieldsOptimisticPatch) => void;
  persistedFieldDraft: CustomFieldDraft;
  setPersistedFieldDraft: (nextValue: CustomFieldDraft) => void;
  workspaceSlug: string;
}) {
  const saveRequestIdRef = useRef(0);
  const saveMutation = useMutation({
    mutationFn: async (payload: CustomFieldDraft & { requestId: number }) => {
      const formData = new FormData();
      formData.set("boardId", params.boardId);
      formData.set("workspaceSlug", params.workspaceSlug);
      formData.set("cardId", params.cardId);
      formData.set("status", payload.status);
      formData.set("priority", payload.priority);
      formData.set("effort", payload.effort);
      const result = await updateCardCustomFieldsInline(formData);
      return { payload, result };
    },
    onError: () => {
      toast.error("Không thể lưu custom fields.");
    },
    onSuccess: ({ payload, result }) => {
      if (payload.requestId !== saveRequestIdRef.current) {
        return;
      }

      if (!result.ok) {
        toast.error(result.error ?? "Không thể lưu custom fields.");
        params.onOptimisticCustomFieldsChange?.({
          effort: params.persistedFieldDraft.effort || null,
          priority: params.persistedFieldDraft.priority || null,
          status: params.persistedFieldDraft.status || null,
        });
        return;
      }

      params.setPersistedFieldDraft({
        effort: payload.effort,
        priority: payload.priority,
        status: payload.status,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(params.draftStorageKey);
      }
    },
  });
  const isSaving = saveMutation.isPending;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!params.hasUnsavedFieldChanges) {
      window.localStorage.removeItem(params.draftStorageKey);
      return;
    }

    window.localStorage.setItem(params.draftStorageKey, JSON.stringify(params.fieldDraft));
  }, [params.draftStorageKey, params.fieldDraft, params.hasUnsavedFieldChanges]);

  useEffect(() => {
    if (!params.canWrite || isSaving || !params.hasUnsavedFieldChanges) {
      return;
    }

    const timer = window.setTimeout(() => {
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      saveMutation.mutate({
        effort: params.fieldDraft.effort,
        priority: params.fieldDraft.priority,
        requestId,
        status: params.fieldDraft.status,
      });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isSaving, params.canWrite, params.fieldDraft, params.hasUnsavedFieldChanges, saveMutation]);

  useEffect(() => {
    if (!params.canWrite || (!params.hasUnsavedFieldChanges && !isSaving)) {
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
  }, [isSaving, params.canWrite, params.hasUnsavedFieldChanges]);

  return { isSaving };
}

export function CardCustomFieldsSection({
  boardId,
  canWrite,
  card,
  onOptimisticCustomFieldsChange,
  workspaceSlug,
}: CardCustomFieldsSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const initialDraft = buildDraftFromCard(card);
  const draftStorageKey = `board:${workspaceSlug}:${boardId}:card:${card.id}:custom-fields-draft`;
  const [fieldDraft, setFieldDraft] = useState<CustomFieldDraft>(() => readStoredDraft(draftStorageKey, initialDraft));
  const [persistedFieldDraft, setPersistedFieldDraft] = useState<CustomFieldDraft>(initialDraft);
  const hasUnsavedFieldChanges =
    fieldDraft.effort !== persistedFieldDraft.effort ||
    fieldDraft.priority !== persistedFieldDraft.priority ||
    fieldDraft.status !== persistedFieldDraft.status;
  const { isSaving } = useAutosaveCustomFields({
    boardId,
    canWrite,
    cardId: card.id,
    draftStorageKey,
    fieldDraft,
    hasUnsavedFieldChanges,
    onOptimisticCustomFieldsChange,
    persistedFieldDraft,
    setPersistedFieldDraft,
    workspaceSlug,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[31px] font-semibold text-slate-200">Trường tùy chỉnh</p>
        <Button
          className="h-10 border-slate-600 bg-white/10 px-4 text-slate-100 hover:bg-white/15"
          onClick={() => {
            setIsEditing((previous) => !previous);
          }}
          type="button"
          variant="secondary"
        >
          {isEditing ? "Xong" : "Chỉnh sửa"}
        </Button>
      </div>
      <CardCustomFieldsInputs
        canWrite={canWrite}
        effort={fieldDraft.effort}
        isEditing={isEditing}
        onEffortChange={(nextValue) => {
          setFieldDraft((previous) => ({ ...previous, effort: nextValue }));
          onOptimisticCustomFieldsChange?.({ effort: nextValue || null });
        }}
        onPriorityChange={(nextValue) => {
          setFieldDraft((previous) => ({ ...previous, priority: nextValue }));
          onOptimisticCustomFieldsChange?.({ priority: nextValue || null });
        }}
        onStatusChange={(nextValue) => {
          setFieldDraft((previous) => ({ ...previous, status: nextValue }));
          onOptimisticCustomFieldsChange?.({ status: nextValue || null });
        }}
        priority={fieldDraft.priority}
        status={fieldDraft.status}
      />
      <p className="text-xs text-slate-400">
        {!canWrite ? "Chế độ chỉ xem" : isSaving ? "Đang lưu custom fields..." : hasUnsavedFieldChanges ? "Chưa lưu" : "Đã lưu"}
      </p>
    </section>
  );
}
