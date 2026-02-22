"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createChecklistInline,
  createWorkspaceLabelAndAttachInline,
  ensureDefaultWorkspaceLabelsInline,
  getRecentAttachmentLinksInline,
} from "../actions.card-richness";
import { DEFAULT_LABEL_PRESETS } from "../label-presets";
import type { LabelRecord } from "../types";
import { type RecentAttachmentLinkItem } from "./card-quick-add-menu-attachments-panel";
import { sortLabelsByPresetOrder } from "./card-quick-add-menu-panels";

export type MenuView = "attachments" | "create-checklist" | "create-label" | "labels" | "members" | "menu";

type UseQuickAddMenuStateArgs = {
  boardId: string;
  canManageLabels: boolean;
  canWrite: boolean;
  cardId: string;
  workspaceLabels: LabelRecord[];
  workspaceSlug: string;
};

export function mergeFiles(previous: File[], incoming: File[]): File[] {
  const keys = new Set(previous.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const merged = [...previous];

  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    merged.push(file);
  }

  return merged;
}

// eslint-disable-next-line max-lines-per-function
export function useQuickAddMenuState({
  boardId,
  canWrite,
  canManageLabels,
  cardId,
  workspaceLabels,
  workspaceSlug,
}: UseQuickAddMenuStateArgs) {
  const [activeView, setActiveView] = useState<MenuView>("menu");
  const [attachmentDisplayText, setAttachmentDisplayText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedAttachmentFiles, setSelectedAttachmentFiles] = useState<File[]>([]);
  const [recentAttachmentLinks, setRecentAttachmentLinks] = useState<RecentAttachmentLinkItem[]>([]);
  const [isLoadingRecentAttachmentLinks, setIsLoadingRecentAttachmentLinks] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createChecklistTitle, setCreateChecklistTitle] = useState("Việc cần làm");
  const [createColor, setCreateColor] = useState<string | null>(DEFAULT_LABEL_PRESETS[5]?.color ?? "#579DFF");
  const [localWorkspaceLabels, setLocalWorkspaceLabels] = useState<LabelRecord[]>(() => sortLabelsByPresetOrder(workspaceLabels));
  const [isHydratingDefaults, setIsHydratingDefaults] = useState(false);
  const [isCreatingLabel, startCreatingLabel] = useTransition();
  const [isCreatingChecklist, startCreatingChecklist] = useTransition();

  function resetMenuState() {
    setActiveView("menu");
    setAttachmentDisplayText("");
    setAttachmentUrl("");
    setSelectedAttachmentFiles([]);
    setRecentAttachmentLinks([]);
    setIsLoadingRecentAttachmentLinks(false);
    setQuery("");
    setMemberQuery("");
    setCreateName("");
    setCreateChecklistTitle("Việc cần làm");
    setCreateColor(DEFAULT_LABEL_PRESETS[5]?.color ?? "#579DFF");
    setLocalWorkspaceLabels(sortLabelsByPresetOrder(workspaceLabels));
  }

  async function loadRecentAttachmentLinks() {
    if (!canWrite) {
      setRecentAttachmentLinks([]);
      return;
    }

    setIsLoadingRecentAttachmentLinks(true);
    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("limit", "8");
    try {
      const result = await getRecentAttachmentLinksInline(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Không thể tải liên kết gần đây.");
        return;
      }
      setRecentAttachmentLinks(result.links);
    } finally {
      setIsLoadingRecentAttachmentLinks(false);
    }
  }

  function openCreateLabelView() {
    if (!canManageLabels) {
      toast.error("Bạn không có quyền tạo nhãn.");
      return;
    }
    setCreateName("");
    setCreateColor(DEFAULT_LABEL_PRESETS[5]?.color ?? "#579DFF");
    setActiveView("create-label");
  }

  function hydrateDefaultLabelsIfNeeded() {
    if (!canManageLabels) {
      return;
    }

    if (localWorkspaceLabels.length > 0) {
      return;
    }

    setIsHydratingDefaults(true);
    void (async () => {
      try {
        const formData = new FormData();
        formData.set("boardId", boardId);
        formData.set("workspaceSlug", workspaceSlug);
        const result = await ensureDefaultWorkspaceLabelsInline(formData);
        if (!result.ok) {
          toast.error(result.error ?? "Không thể tải nhãn mặc định.");
          return;
        }
        setLocalWorkspaceLabels(sortLabelsByPresetOrder(result.labels));
      } finally {
        setIsHydratingDefaults(false);
      }
    })();
  }

  async function createLabel() {
    if (!canManageLabels) {
      toast.error("Bạn không có quyền tạo nhãn.");
      return null;
    }

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("cardId", cardId);
    formData.set("name", createName.trim());
    formData.set("color", createColor ?? "#6B7280");
    const result = await createWorkspaceLabelAndAttachInline(formData);
    if (!result.ok) {
      toast.error(result.error ?? "Không thể tạo nhãn mới.");
      return null;
    }

    setLocalWorkspaceLabels((prev) => {
      if (prev.some((label) => label.id === result.label.id)) {
        return prev;
      }
      return sortLabelsByPresetOrder([...prev, result.label]);
    });
    setActiveView("labels");
    setCreateName("");
    setCreateColor(DEFAULT_LABEL_PRESETS[5]?.color ?? "#579DFF");
    toast.success("Đã tạo nhãn mới.");
    return result.label;
  }

  function runCreateLabel(handler: (label: LabelRecord | null) => void) {
    startCreatingLabel(() => {
      void (async () => {
        handler(await createLabel());
      })();
    });
  }

  async function createChecklist() {
    if (!canWrite) {
      toast.error("Bạn không có quyền tạo checklist.");
      return false;
    }

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("cardId", cardId);
    formData.set("title", createChecklistTitle.trim());
    const result = await createChecklistInline(formData);
    if (!result.ok) {
      toast.error(result.error ?? "Không thể tạo checklist.");
      return false;
    }

    setCreateChecklistTitle("Việc cần làm");
    toast.success("Đã tạo checklist.");
    return true;
  }

  function runCreateChecklist(handler: (created: boolean) => void) {
    startCreatingChecklist(() => {
      void (async () => {
        handler(await createChecklist());
      })();
    });
  }

  return {
    activeView,
    attachmentDisplayText,
    attachmentUrl,
    createColor,
    createChecklistTitle,
    createName,
    hydrateDefaultLabelsIfNeeded,
    isCreatingChecklist,
    isCreatingLabel,
    isHydratingDefaults,
    isLoadingRecentAttachmentLinks,
    localWorkspaceLabels,
    loadRecentAttachmentLinks,
    memberQuery,
    openCreateLabelView,
    query,
    recentAttachmentLinks,
    resetMenuState,
    runCreateChecklist,
    runCreateLabel,
    selectedAttachmentFiles,
    setActiveView,
    setAttachmentDisplayText,
    setAttachmentUrl,
    setCreateColor,
    setCreateChecklistTitle,
    setCreateName,
    setMemberQuery,
    setQuery,
    setSelectedAttachmentFiles,
  };
}
