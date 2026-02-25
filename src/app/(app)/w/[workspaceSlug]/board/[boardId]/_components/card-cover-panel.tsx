"use client";

import { Check, EyeOff, Loader2, Search, Upload, X } from "lucide-react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Input } from "@/components/ui";

import {
  addAttachmentUrlInline,
  updateCardCoverInline,
  uploadAttachmentsInline,
} from "../actions.card-richness";
import type { CardRecord } from "../types";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import type { CardCustomFieldsOptimisticPatch } from "./card-richness-modern-ui";

const COVER_COLOR_OPTIONS = [
  "#2E7D5A",
  "#8A6D00",
  "#A65A00",
  "#A93424",
  "#6D3FA8",
  "#2561B9",
  "#266F8E",
  "#466A1E",
  "#9D427E",
  "#5B616A",
] as const;

type CardCoverPanelProps = {
  boardId: string;
  canWrite: boolean;
  card: CardRecord;
  onOptimisticCardPatch?: (patch: CardCustomFieldsOptimisticPatch) => void;
  richnessQueryKey?: readonly [string, string, string, string];
  workspaceSlug: string;
};

type CardCoverMutationPayload = {
  coverAttachmentId: string | null;
  coverColor: string | null;
  coverColorblindFriendly: boolean;
  coverMode: "attachment" | "color" | "none";
  coverSize: "full" | "header";
};

type UnsplashImageRecord = {
  authorName: string;
  color: string | null;
  fullUrl: string;
  id: string;
  regularUrl: string;
  thumbUrl: string;
  title: string;
};

function toCurrentCoverPatch(card: CardRecord): CardCustomFieldsOptimisticPatch {
  return {
    coverAttachmentId: card.coverAttachmentId ?? null,
    coverColor: card.coverColor ?? null,
    coverColorblindFriendly: card.coverColorblindFriendly === true,
    coverMode: card.coverMode ?? "none",
    coverSize: card.coverSize ?? "full",
  };
}

function toFormData(params: {
  boardId: string;
  cardId: string;
  payload: CardCoverMutationPayload;
  workspaceSlug: string;
}) {
  const formData = new FormData();
  formData.set("boardId", params.boardId);
  formData.set("cardId", params.cardId);
  formData.set("workspaceSlug", params.workspaceSlug);
  formData.set("coverMode", params.payload.coverMode);
  formData.set("coverSize", params.payload.coverSize);
  formData.set("coverColorblindFriendly", String(params.payload.coverColorblindFriendly));
  if (params.payload.coverAttachmentId) {
    formData.set("coverAttachmentId", params.payload.coverAttachmentId);
  }
  if (params.payload.coverColor) {
    formData.set("coverColor", params.payload.coverColor);
  }
  return formData;
}

function normalizeCoverFromCard(card: CardRecord) {
  return {
    coverAttachmentId: card.coverAttachmentId ?? null,
    coverColor: card.coverColor ?? null,
    coverColorblindFriendly: card.coverColorblindFriendly === true,
    coverMode: card.coverMode ?? "none",
    coverSize: card.coverSize ?? "full",
  };
}

function CoverSizeOption({
  active,
  label,
  onClick,
  size,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  size: "full" | "header";
}) {
  return (
    <button
      className={`rounded-md border p-1.5 transition ${active ? "border-cyan-400/80 bg-cyan-500/20" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
      onClick={onClick}
      type="button"
    >
      <div className="w-[110px] rounded bg-white/10 p-1">
        <div
          className={`w-full rounded bg-white/20 ${size === "full" ? "h-9" : "h-3"}`}
        />
        <div className="mt-1 space-y-1">
          <div className="h-1 w-14 rounded bg-white/20" />
          <div className="h-1 w-10 rounded bg-white/10" />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-slate-200">{label}</p>
    </button>
  );
}

// eslint-disable-next-line max-lines-per-function
export function CardCoverPanel({
  boardId,
  canWrite,
  card,
  onOptimisticCardPatch,
  richnessQueryKey,
  workspaceSlug,
}: CardCoverPanelProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId: card.id,
    workspaceSlug,
  });
  const currentCover = normalizeCoverFromCard(card);
  const [searchValue, setSearchValue] = useState("nature");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("nature");
  const [isUnsplashLoading, setIsUnsplashLoading] = useState(false);
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImageRecord[]>([]);

  const coverMutation = useMutation({
    mutationKey: [...modalMutationKey, "cover"],
    mutationFn: async (payload: CardCoverMutationPayload) => {
      const formData = toFormData({
        boardId,
        cardId: card.id,
        payload,
        workspaceSlug,
      });
      return updateCardCoverInline(formData);
    },
    onMutate: (payload) => {
      const previousCover = toCurrentCoverPatch(card);
      onOptimisticCardPatch?.({
        coverAttachmentId: payload.coverAttachmentId,
        coverColor: payload.coverColor,
        coverColorblindFriendly: payload.coverColorblindFriendly,
        coverMode: payload.coverMode,
        coverSize: payload.coverSize,
      });
      return { previousCover };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousCover) {
        onOptimisticCardPatch?.(context.previousCover);
      }
      toast.error("Không thể cập nhật ảnh bìa.");
    },
    onSuccess: (result, _payload, context) => {
      if (!result.ok) {
        if (context?.previousCover) {
          onOptimisticCardPatch?.(context.previousCover);
        }
        toast.error(result.error ?? "Không thể cập nhật ảnh bìa.");
        return;
      }

      onOptimisticCardPatch?.({
        coverAttachmentId: result.cover.coverAttachmentId,
        coverColor: result.cover.coverColor,
        coverColorblindFriendly: result.cover.coverColorblindFriendly,
        coverMode: result.cover.coverMode,
        coverSize: result.cover.coverSize,
      });
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim().length > 0 ? searchValue.trim() : "nature");
    }, 280);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchValue]);

  useEffect(() => {
    let isDisposed = false;
    const loadUnsplash = async () => {
      setIsUnsplashLoading(true);
      try {
        const query = new URLSearchParams({
          perPage: "6",
          query: debouncedSearchValue,
        });
        const response = await fetch(`/api/unsplash/search?${query.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const payload = await response.json() as { error?: string; results?: UnsplashImageRecord[] };
        if (!response.ok) {
          if (!isDisposed) {
            setUnsplashImages([]);
          }
          if (payload.error) {
            toast.error(payload.error);
          }
          return;
        }

        if (!isDisposed) {
          setUnsplashImages(Array.isArray(payload.results) ? payload.results : []);
        }
      } catch {
        if (!isDisposed) {
          setUnsplashImages([]);
        }
      } finally {
        if (!isDisposed) {
          setIsUnsplashLoading(false);
        }
      }
    };

    void loadUnsplash();
    return () => {
      isDisposed = true;
    };
  }, [debouncedSearchValue]);

  const isBusy = coverMutation.isPending || isUnsplashLoading;
  const coverSize = currentCover.coverSize;
  const activeColor = currentCover.coverMode === "color" ? currentCover.coverColor : null;
  const colorblindFriendly = currentCover.coverColorblindFriendly;
  const hasCover = currentCover.coverMode !== "none";
  const disableActions = !canWrite || coverMutation.isPending;

  const updateCover = (payload: CardCoverMutationPayload) => {
    if (disableActions) {
      return;
    }
    coverMutation.mutate(payload);
  };

  const applyCoverColor = (color: string) => {
    updateCover({
      coverAttachmentId: null,
      coverColor: color,
      coverColorblindFriendly: colorblindFriendly,
      coverMode: "color",
      coverSize,
    });
  };

  const applyCoverSize = (size: "full" | "header") => {
    updateCover({
      coverAttachmentId: currentCover.coverMode === "attachment" ? currentCover.coverAttachmentId : null,
      coverColor: currentCover.coverMode === "color" ? currentCover.coverColor : null,
      coverColorblindFriendly: colorblindFriendly,
      coverMode: currentCover.coverMode,
      coverSize: size,
    });
  };

  const applyAttachmentCover = async (url: string, title: string) => {
    if (!canWrite || coverMutation.isPending) {
      return;
    }

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("cardId", card.id);
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("externalUrl", url);
    formData.set("displayText", title.trim().length > 0 ? title : "Unsplash image");
    const addAttachmentResult = await addAttachmentUrlInline(formData);
    if (!addAttachmentResult.ok) {
      toast.error(addAttachmentResult.error ?? "Không thể thêm ảnh vào thẻ.");
      return;
    }
    if (!addAttachmentResult.attachment?.id) {
      toast.error("Không thể thêm ảnh vào thẻ.");
      return;
    }

    if (richnessQueryKey) {
      await queryClient.invalidateQueries({ queryKey: richnessQueryKey });
    }

    updateCover({
      coverAttachmentId: addAttachmentResult.attachment.id,
      coverColor: null,
      coverColorblindFriendly: colorblindFriendly,
      coverMode: "attachment",
      coverSize,
    });
  };

  const handleUploadFile = async (file: File | null) => {
    if (!file || !canWrite || coverMutation.isPending) {
      return;
    }

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("cardId", card.id);
    formData.set("workspaceSlug", workspaceSlug);
    formData.append("files", file);
    const uploadResult = await uploadAttachmentsInline(formData);
    if (!uploadResult.ok) {
      toast.error(uploadResult.error ?? "Không thể tải ảnh bìa.");
      return;
    }

    const insertedAttachment = uploadResult.attachments?.[0];
    if (!insertedAttachment?.id) {
      toast.error("Không tìm thấy tệp vừa tải lên.");
      return;
    }

    if (richnessQueryKey) {
      await queryClient.invalidateQueries({ queryKey: richnessQueryKey });
    }

    updateCover({
      coverAttachmentId: insertedAttachment.id,
      coverColor: null,
      coverColorblindFriendly: colorblindFriendly,
      coverMode: "attachment",
      coverSize,
    });
  };

  const previewText = useMemo(() => {
    if (currentCover.coverMode === "attachment" && currentCover.coverAttachmentId) {
      return "Đang dùng ảnh đính kèm làm ảnh bìa.";
    }
    if (currentCover.coverMode === "color" && currentCover.coverColor) {
      return `Đang dùng màu ${currentCover.coverColor}.`;
    }
    return "Thẻ chưa có ảnh bìa.";
  }, [currentCover.coverAttachmentId, currentCover.coverColor, currentCover.coverMode]);

  return (
    <section className="w-[320px] space-y-3 p-1 text-slate-100">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-slate-100">Ảnh bìa</p>
        <p className="text-[11px] text-slate-400">{previewText}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kích thước</p>
        <div className="flex items-center gap-2">
          <CoverSizeOption
            active={coverSize === "full"}
            label="Đầy đủ"
            onClick={() => {
              applyCoverSize("full");
            }}
            size="full"
          />
          <CoverSizeOption
            active={coverSize === "header"}
            label="Tiêu đề"
            onClick={() => {
              applyCoverSize("header");
            }}
            size="header"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Màu sắc</p>
        <div className="grid grid-cols-5 gap-1.5">
          {COVER_COLOR_OPTIONS.map((color) => (
            <button
              aria-label={`Chọn màu ${color}`}
              className={`relative h-7 rounded-md border transition ${activeColor === color ? "border-cyan-300/90 ring-1 ring-cyan-300/60" : "border-white/10 hover:border-white/25"}`}
              key={color}
              onClick={() => {
                applyCoverColor(color);
              }}
              style={{ backgroundColor: color }}
              type="button"
            >
              {activeColor === color ? <Check className="absolute right-1 top-1 h-3 w-3 text-white" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <Button
          className="h-9 w-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.06]"
          disabled={disableActions}
          onClick={() => {
            fileInputRef.current?.click();
          }}
          type="button"
          variant="secondary"
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          Tải lên ảnh bìa
        </Button>
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void handleUploadFile(file);
            event.currentTarget.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ảnh từ Unsplash</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            className="h-8 border-white/10 bg-black/20 pl-7 text-sm text-slate-100 placeholder:text-slate-500"
            disabled={!canWrite}
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            placeholder="Tìm ảnh..."
            value={searchValue}
          />
        </div>
        {isUnsplashLoading ? (
          <div className="flex h-24 items-center justify-center rounded-md border border-white/10 bg-black/20">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {unsplashImages.map((image) => (
              <button
                className="group relative h-14 overflow-hidden rounded-md border border-white/10 transition hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disableActions}
                key={image.id}
                onClick={() => {
                  void applyAttachmentCover(image.fullUrl, image.title);
                }}
                type="button"
              >
                <Image
                  alt={image.title}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  height={56}
                  src={image.thumbUrl}
                  unoptimized
                  width={96}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <Button
          className="h-8 w-full justify-start border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/[0.04]"
          disabled={disableActions}
          onClick={() => {
            updateCover({
              coverAttachmentId: currentCover.coverAttachmentId,
              coverColor: currentCover.coverColor,
              coverColorblindFriendly: !colorblindFriendly,
              coverMode: currentCover.coverMode,
              coverSize,
            });
          }}
          type="button"
          variant="secondary"
        >
          {colorblindFriendly ? <Check className="mr-2 h-3.5 w-3.5" /> : <EyeOff className="mr-2 h-3.5 w-3.5" />}
          {colorblindFriendly ? "Đã bật chế độ thân thiện mù màu" : "Bật chế độ thân thiện mù màu"}
        </Button>
        <Button
          className="h-8 w-full justify-start border-rose-400/30 bg-rose-500/10 text-xs text-rose-200 hover:bg-rose-500/20"
          disabled={!hasCover || disableActions}
          onClick={() => {
            updateCover({
              coverAttachmentId: null,
              coverColor: null,
              coverColorblindFriendly: colorblindFriendly,
              coverMode: "none",
              coverSize,
            });
          }}
          type="button"
          variant="secondary"
        >
          <X className="mr-2 h-3.5 w-3.5" />
          Xóa ảnh bìa
        </Button>
      </div>

      {isBusy ? (
        <p className="text-[11px] text-slate-400">Đang đồng bộ ảnh bìa...</p>
      ) : null}
    </section>
  );
}
