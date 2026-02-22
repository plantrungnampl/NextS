"use client";
/* eslint-disable max-lines */

import {
  Ellipsis,
  ExternalLink,
  Eye,
  File,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import {
  addAttachmentUrlInline,
  deleteAttachmentInline,
  getRecentAttachmentLinksInline,
  refreshLegacyAttachmentTitlesInline,
  uploadAttachmentsInline,
} from "../actions.card-richness";
import type { AttachmentRecord } from "../types";
import { AttachmentsPanel, type RecentAttachmentLinkItem } from "./card-quick-add-menu-attachments-panel";
import { mergeFiles } from "./card-quick-add-menu-state";
import {
  attachmentPreviewUrl,
  type AttachmentDomainBrand,
  formatAttachmentSize,
  formatAttachmentTimestamp,
  resolveAttachmentDomainBrand,
  resolveAttachmentHost,
  resolveAttachmentOpenUrl,
  resolveAttachmentPreviewKind,
} from "./card-richness-attachments-helpers";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { getInitials } from "./card-ui-utils";

type AttachmentMutationResult = { ok: true; uploadedCount?: number } | { error: string; ok: false };

type AttachmentSectionGroup = {
  files: AttachmentRecord[];
  links: AttachmentRecord[];
};

type BrandBadgePreset = {
  className: string;
  label: string;
  text: string;
};

const BRAND_BADGE_PRESETS: Record<AttachmentDomainBrand, BrandBadgePreset> = {
  facebook: {
    className: "bg-[#1877f2] text-white",
    label: "Facebook",
    text: "f",
  },
  generic: {
    className: "bg-slate-600 text-slate-100",
    label: "Link",
    text: "↗",
  },
  instagram: {
    className: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
    label: "Instagram",
    text: "ig",
  },
  linkedin: {
    className: "bg-[#0a66c2] text-white",
    label: "LinkedIn",
    text: "in",
  },
  tiktok: {
    className: "bg-black text-white",
    label: "TikTok",
    text: "tt",
  },
  x: {
    className: "bg-black text-white",
    label: "X",
    text: "x",
  },
  youtube: {
    className: "bg-[#ff0033] text-white",
    label: "YouTube",
    text: "▶",
  },
};

function invalidateRichnessQuery(params: {
  queryClient: QueryClient;
  richnessQueryKey: readonly [string, string, string, string];
}) {
  void params.queryClient.invalidateQueries({ queryKey: params.richnessQueryKey });
}

function toFormData(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

function truncateAttachmentTitle(value: string, maxChars = 78): string {
  const normalized = value.trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) {
    return normalized;
  }

  return `${chars.slice(0, maxChars).join("").trimEnd()}...`;
}

function normalizeLegacyComparableUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString().toLowerCase();
  } catch {
    return null;
  }
}

function normalizeLegacyTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, "");
}

function hasLegacyLinkTitleCandidate(attachment: AttachmentRecord): boolean {
  if (attachment.sourceType !== "url" || !attachment.externalUrl) {
    return false;
  }

  const normalizedTitle = normalizeLegacyTitle(attachment.fileName);
  if (normalizedTitle.length < 1) {
    return true;
  }
  if (normalizedTitle.startsWith("http://") || normalizedTitle.startsWith("https://")) {
    return true;
  }

  const normalizedUrl = normalizeLegacyComparableUrl(attachment.externalUrl);
  if (!normalizedUrl) {
    return false;
  }

  const comparableTitle = stripTrailingSlashes(normalizedTitle);
  const comparableUrl = stripTrailingSlashes(normalizedUrl);
  const comparableUrlWithoutProtocol = stripProtocol(comparableUrl);

  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    const hostAndPath = normalizeLegacyTitle(
      `${parsed.hostname}${parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : ""}`,
    );

    return normalizedTitle === host
      || normalizedTitle === hostAndPath
      || comparableTitle === comparableUrl
      || comparableTitle === comparableUrlWithoutProtocol;
  } catch {
    return false;
  }
}

function groupAttachments(attachments: AttachmentRecord[]): AttachmentSectionGroup {
  const sortedAttachments = [...attachments].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const groups: AttachmentSectionGroup = {
    files: [],
    links: [],
  };

  for (const attachment of sortedAttachments) {
    if (attachment.sourceType === "url") {
      groups.links.push(attachment);
      continue;
    }

    groups.files.push(attachment);
  }

  return groups;
}

function AttachmentKindIcon({ attachment }: { attachment: AttachmentRecord }) {
  if (attachment.sourceType === "url") {
    const brand = resolveAttachmentDomainBrand(attachment);
    const preset = BRAND_BADGE_PRESETS[brand];
    return (
      <span
        aria-label={preset.label}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold uppercase leading-none ${preset.className}`}
      >
        {preset.text}
      </span>
    );
  }

  const previewKind = resolveAttachmentPreviewKind(attachment);
  const Icon = previewKind === "pdf" ? FileText : previewKind === "text" ? File : previewKind === "image" ? FileImage : File;

  return <Icon className="h-3.5 w-3.5 text-slate-300" />;
}

function AttachmentPreviewDialog({
  attachment,
  onOpenChange,
}: {
  attachment: AttachmentRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const kind = attachment ? resolveAttachmentPreviewKind(attachment) : "other";
  const openHref = attachment ? resolveAttachmentOpenUrl(attachment) : null;
  const isExternalUrlAttachment = Boolean(attachment && attachment.sourceType === "url" && attachment.externalUrl);

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(attachment)}>
      <DialogContent className="w-[min(92vw,980px)] border border-slate-700/80 bg-[#1d2535] p-0 text-slate-100">
        <DialogTitle className="border-b border-slate-700/80 px-5 py-3 text-sm font-semibold">
          {attachment?.fileName ?? "Xem trước tệp đính kèm"}
        </DialogTitle>
        <DialogDescription className="sr-only">Xem trước tệp đính kèm của thẻ trong hộp thoại.</DialogDescription>
        {attachment ? (
          <div className="p-4">
            {isExternalUrlAttachment ? (
              <div className="rounded-md border border-slate-700 bg-[#0f1318] p-4">
                <p className="text-sm text-slate-300">Đây là liên kết ngoài.</p>
                <a
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                  href={openHref ?? "#"}
                  rel="noreferrer"
                  target="_blank"
                >
                  Mở liên kết
                </a>
              </div>
            ) : null}
            {kind === "image" ? (
              <Image
                alt={attachment.fileName}
                className="max-h-[72vh] w-full rounded-md border border-slate-700 object-contain"
                height={900}
                src={openHref ?? attachmentPreviewUrl(attachment.id)}
                unoptimized
                width={1440}
              />
            ) : null}
            {kind === "pdf" ? (
              <iframe
                className="h-[72vh] w-full rounded-md border border-slate-700 bg-white"
                src={openHref ?? attachmentPreviewUrl(attachment.id)}
                title={attachment.fileName}
              />
            ) : null}
            {!isExternalUrlAttachment && kind !== "image" && kind !== "pdf" ? (
              <div className="rounded-md border border-slate-700 bg-[#0f1318] p-4">
                <p className="text-sm text-slate-300">Loại tệp này chưa hỗ trợ xem trước.</p>
                <a
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                  href={openHref ?? "#"}
                  rel="noreferrer"
                  target="_blank"
                >
                  Mở tệp trong tab mới
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AttachmentRowActions({
  attachment,
  canDelete,
  isPending,
  onDelete,
  onPreview,
}: {
  attachment: AttachmentRecord;
  canDelete: boolean;
  isPending: boolean;
  onDelete: (attachmentId: string) => void;
  onPreview: () => void;
}) {
  const isExternalUrlAttachment = attachment.sourceType === "url" && Boolean(attachment.externalUrl);
  const openHref = resolveAttachmentOpenUrl(attachment);

  return (
    <div className="flex items-center gap-1">
      {!isExternalUrlAttachment ? (
        <button
          aria-label="Xem trước tệp"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          onClick={onPreview}
          type="button"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <a
        aria-label={isExternalUrlAttachment ? "Mở liên kết" : "Mở tệp"}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
        href={openHref}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Mở menu đính kèm"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
            type="button"
          >
            <Ellipsis className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 border border-white/15 bg-slate-900/95 text-slate-100">
          {!isExternalUrlAttachment ? (
            <DropdownMenuItem
              className="text-slate-200"
              onClick={() => {
                onPreview();
              }}
            >
              <Eye className="mr-2 h-3.5 w-3.5" />
              Xem trước
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild className="text-slate-200">
            <a href={openHref} rel="noreferrer" target="_blank">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              {isExternalUrlAttachment ? "Mở liên kết" : "Mở tệp"}
            </a>
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem
              className="text-rose-200 focus:text-rose-100"
              disabled={isPending}
              onClick={() => {
                onDelete(attachment.id);
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Xóa
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
  isPending,
  onDelete,
  onPreview,
}: {
  attachment: AttachmentRecord;
  canDelete: boolean;
  isPending: boolean;
  onDelete: (attachmentId: string) => void;
  onPreview: (attachment: AttachmentRecord) => void;
}) {
  const isExternalUrlAttachment = attachment.sourceType === "url" && Boolean(attachment.externalUrl);
  const host = resolveAttachmentHost(attachment);
  const sizeLabel = isExternalUrlAttachment ? (host ?? "Liên kết ngoài") : formatAttachmentSize(attachment.sizeBytes);
  const renderedTitle = truncateAttachmentTitle(attachment.fileName);

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-700/70 bg-[#0f1318] px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700/60">
            <AttachmentKindIcon attachment={attachment} />
          </span>
          {isExternalUrlAttachment ? (
            <a
              className="block min-w-0 flex-1 truncate text-sm font-medium text-sky-300 hover:underline"
              href={resolveAttachmentOpenUrl(attachment)}
              rel="noreferrer"
              target="_blank"
              title={attachment.fileName}
            >
              {renderedTitle}
            </a>
          ) : (
            <button
              className="block min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-100 hover:underline"
              onClick={() => {
                onPreview(attachment);
              }}
              title={attachment.fileName}
              type="button"
            >
              {renderedTitle}
            </button>
          )}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
          <Avatar className="h-4 w-4 border border-slate-700">
            {attachment.createdByAvatarUrl ? (
              <AvatarImage alt={attachment.createdByDisplayName} src={attachment.createdByAvatarUrl} />
            ) : null}
            <AvatarFallback className="bg-slate-700 text-[9px] text-slate-100">
              {getInitials(attachment.createdByDisplayName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{attachment.createdByDisplayName}</span>
          <span>•</span>
          <span className="truncate">{sizeLabel}</span>
          <span>•</span>
          <span className="truncate">{formatAttachmentTimestamp(attachment.createdAt)}</span>
        </div>
      </div>

      <AttachmentRowActions
        attachment={attachment}
        canDelete={canDelete}
        isPending={isPending}
        onDelete={onDelete}
        onPreview={() => {
          onPreview(attachment);
        }}
      />
    </div>
  );
}

function AttachmentGroup({
  attachments,
  canManageAllAttachments,
  canWrite,
  isPending,
  title,
  onDelete,
  onPreview,
  submitMutation,
  viewerId,
}: {
  attachments: AttachmentRecord[];
  canManageAllAttachments: boolean;
  canWrite: boolean;
  isPending: boolean;
  title: string;
  onDelete: (attachmentId: string) => Promise<AttachmentMutationResult>;
  onPreview: (attachment: AttachmentRecord) => void;
  submitMutation: (run: () => Promise<AttachmentMutationResult>) => void;
  viewerId: string;
}) {
  if (attachments.length < 1) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <div className="space-y-1.5">
        {attachments.map((attachment) => (
          <AttachmentRow
            attachment={attachment}
            canDelete={canWrite && (canManageAllAttachments || attachment.createdBy === viewerId)}
            isPending={isPending}
            key={attachment.id}
            onDelete={(attachmentId) => {
              submitMutation(() => onDelete(attachmentId));
            }}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardAttachmentsSection({
  attachments,
  boardId,
  canManageAllAttachments,
  canWrite,
  cardId,
  richnessQueryKey,
  viewerId,
  workspaceSlug,
}: {
  attachments: AttachmentRecord[];
  boardId: string;
  canManageAllAttachments: boolean;
  canWrite: boolean;
  cardId: string;
  richnessQueryKey: readonly [string, string, string, string];
  viewerId: string;
  workspaceSlug: string;
}) {
  const [isAttachmentsPanelOpen, setIsAttachmentsPanelOpen] = useState(false);
  const [isLoadingRecentAttachmentLinks, setIsLoadingRecentAttachmentLinks] = useState(false);
  const [isSubmittingAttachments, setIsSubmittingAttachments] = useState(false);
  const [attachmentDisplayText, setAttachmentDisplayText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selectedAttachmentFiles, setSelectedAttachmentFiles] = useState<File[]>([]);
  const [recentAttachmentLinks, setRecentAttachmentLinks] = useState<RecentAttachmentLinkItem[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRecord | null>(null);
  const attemptedLegacyRefreshCardIdRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });

  const mutation = useMutation({
    mutationKey: [...modalMutationKey, "attachments"],
    mutationFn: async (run: () => Promise<AttachmentMutationResult>) => run(),
    onError: () => {
      toast.error("Không thể đồng bộ tệp đính kèm.");
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      invalidateRichnessQuery({
        queryClient,
        richnessQueryKey,
      });
    },
  });

  const groupedAttachments = useMemo(() => {
    return groupAttachments(attachments);
  }, [attachments]);
  const hasAttachments = groupedAttachments.links.length > 0 || groupedAttachments.files.length > 0;
  const hasLegacyTitleCandidates = useMemo(() => {
    return groupedAttachments.links.some((attachment) => hasLegacyLinkTitleCandidate(attachment));
  }, [groupedAttachments.links]);

  const isPending = mutation.isPending || isSubmittingAttachments;

  const submitMutation = (run: () => Promise<AttachmentMutationResult>) => {
    mutation.mutate(run);
  };

  const resetAttachmentsPanelState = () => {
    setAttachmentDisplayText("");
    setAttachmentUrl("");
    setSelectedAttachmentFiles([]);
    setRecentAttachmentLinks([]);
    setIsLoadingRecentAttachmentLinks(false);
    setIsSubmittingAttachments(false);
  };

  const closeAttachmentsPanel = () => {
    setIsAttachmentsPanelOpen(false);
    resetAttachmentsPanelState();
  };

  const handleAttachmentsPanelOpenChange = (nextOpen: boolean) => {
    setIsAttachmentsPanelOpen(nextOpen);
    if (!nextOpen) {
      resetAttachmentsPanelState();
    }
  };

  const loadRecentAttachmentLinks = async () => {
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
  };

  useEffect(() => {
    if (!isAttachmentsPanelOpen) {
      return;
    }

    void loadRecentAttachmentLinks();
  }, [isAttachmentsPanelOpen]);

  useEffect(() => {
    if (!canWrite || !hasLegacyTitleCandidates) {
      return;
    }
    if (attemptedLegacyRefreshCardIdRef.current === cardId) {
      return;
    }

    attemptedLegacyRefreshCardIdRef.current = cardId;

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("cardId", cardId);
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("limit", "5");

    void (async () => {
      const result = await refreshLegacyAttachmentTitlesInline(formData);
      if (!result.ok || result.updatedCount < 1) {
        return;
      }

      invalidateRichnessQuery({
        queryClient,
        richnessQueryKey,
      });
    })();
  }, [boardId, canWrite, cardId, hasLegacyTitleCandidates, queryClient, richnessQueryKey, workspaceSlug]);

  const handleSubmitAttachments = () => {
    if (!canWrite || isSubmittingAttachments) {
      return;
    }

    const trimmedUrl = attachmentUrl.trim();
    const hasUrl = trimmedUrl.length > 0;
    if (selectedAttachmentFiles.length < 1 && !hasUrl) {
      toast.error("Chọn tệp hoặc dán liên kết trước khi chèn.");
      return;
    }

    setIsSubmittingAttachments(true);
    submitMutation(async () => {
      let uploadedCount = 0;
      let insertedUrl = false;
      let hasMutation = false;
      const errors: string[] = [];

      try {
        if (selectedAttachmentFiles.length > 0) {
          const uploadPayload = new FormData();
          uploadPayload.set("boardId", boardId);
          uploadPayload.set("cardId", cardId);
          uploadPayload.set("workspaceSlug", workspaceSlug);
          for (const file of selectedAttachmentFiles) {
            uploadPayload.append("files", file);
          }

          const uploadResult = await uploadAttachmentsInline(uploadPayload);
          if (uploadResult.ok) {
            hasMutation = true;
            uploadedCount = uploadResult.uploadedCount ?? selectedAttachmentFiles.length;
          } else {
            errors.push(uploadResult.error ?? "Không thể tải tệp đính kèm.");
          }
        }

        if (hasUrl) {
          const urlPayload = new FormData();
          urlPayload.set("boardId", boardId);
          urlPayload.set("cardId", cardId);
          urlPayload.set("workspaceSlug", workspaceSlug);
          urlPayload.set("externalUrl", trimmedUrl);
          if (attachmentDisplayText.trim().length > 0) {
            urlPayload.set("displayText", attachmentDisplayText.trim());
          }

          const addUrlResult = await addAttachmentUrlInline(urlPayload);
          if (addUrlResult.ok) {
            hasMutation = true;
            insertedUrl = true;
          } else {
            errors.push(addUrlResult.error ?? "Không thể đính kèm liên kết.");
          }
        }

        if (errors.length > 0) {
          return { error: errors[0] ?? "Không thể chèn đính kèm.", ok: false };
        }

        if (hasMutation) {
          const parts: string[] = [];
          if (uploadedCount > 0) {
            parts.push(`đã tải ${uploadedCount} tệp`);
          }
          if (insertedUrl) {
            parts.push("đã thêm liên kết");
          }
          toast.success(parts.length > 0 ? `Đã chèn: ${parts.join(", ")}.` : "Đã chèn đính kèm.");
          closeAttachmentsPanel();
          return { ok: true };
        }

        return { error: "Không thể chèn đính kèm.", ok: false };
      } finally {
        setIsSubmittingAttachments(false);
      }
    });
  };

  if (!hasAttachments) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-base font-semibold text-slate-200">
          <Paperclip className="h-4 w-4" />
          Các tệp tin đính kèm
        </p>

        <Popover onOpenChange={handleAttachmentsPanelOpenChange} open={isAttachmentsPanelOpen}>
          <PopoverTrigger asChild>
            <Button
              className="h-8 border-slate-600 bg-transparent px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
              disabled={!canWrite}
              type="button"
              variant="secondary"
            >
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Thêm
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[304px] border-slate-600 bg-[#33363d] p-0 text-slate-100" data-lane-pan-stop>
            <AttachmentsPanel
              canWrite={canWrite}
              displayText={attachmentDisplayText}
              isLoadingRecentLinks={isLoadingRecentAttachmentLinks}
              isSubmitting={isPending}
              onBack={closeAttachmentsPanel}
              onClose={closeAttachmentsPanel}
              onDisplayTextChange={setAttachmentDisplayText}
              onPickRecentLink={(link) => {
                setAttachmentUrl(link.url);
                if (attachmentDisplayText.trim().length < 1) {
                  setAttachmentDisplayText(link.title);
                }
              }}
              onRemoveSelectedFile={(index) => {
                setSelectedAttachmentFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
              }}
              onSelectFiles={(files) => {
                setSelectedAttachmentFiles((previous) => mergeFiles(previous, files));
              }}
              onSubmit={handleSubmitAttachments}
              onUrlChange={setAttachmentUrl}
              recentLinks={recentAttachmentLinks}
              selectedFiles={selectedAttachmentFiles}
              urlValue={attachmentUrl}
            />
          </PopoverContent>
        </Popover>
      </div>

      <AttachmentGroup
        attachments={groupedAttachments.links}
        canManageAllAttachments={canManageAllAttachments}
        canWrite={canWrite}
        isPending={isPending}
        onDelete={async (attachmentId) => {
          return deleteAttachmentInline(
            toFormData([
              ["attachmentId", attachmentId],
              ["boardId", boardId],
              ["workspaceSlug", workspaceSlug],
            ]),
          );
        }}
        onPreview={setPreviewAttachment}
        submitMutation={submitMutation}
        title="Liên kết"
        viewerId={viewerId}
      />

      <AttachmentGroup
        attachments={groupedAttachments.files}
        canManageAllAttachments={canManageAllAttachments}
        canWrite={canWrite}
        isPending={isPending}
        onDelete={async (attachmentId) => {
          return deleteAttachmentInline(
            toFormData([
              ["attachmentId", attachmentId],
              ["boardId", boardId],
              ["workspaceSlug", workspaceSlug],
            ]),
          );
        }}
        onPreview={setPreviewAttachment}
        submitMutation={submitMutation}
        title="Tệp"
        viewerId={viewerId}
      />

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
      />
    </section>
  );
}
