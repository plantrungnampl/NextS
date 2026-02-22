"use client";

import { ChevronLeft, Link2, Loader2, Paperclip, X } from "lucide-react";
import { useMemo, useRef } from "react";

import { LoadingInline } from "@/components/ui";

import { formatAttachmentSize, formatAttachmentTimestamp } from "./card-richness-attachments-helpers";

const FILE_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,text/plain";

export type RecentAttachmentLinkItem = {
  attachmentId: string;
  createdAt: string;
  title: string;
  url: string;
};

type AttachmentsPanelProps = {
  canWrite: boolean;
  displayText: string;
  isLoadingRecentLinks: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onClose: () => void;
  onDisplayTextChange: (value: string) => void;
  onPickRecentLink: (link: RecentAttachmentLinkItem) => void;
  onRemoveSelectedFile: (index: number) => void;
  onSelectFiles: (files: File[]) => void;
  onSubmit: () => void;
  onUrlChange: (value: string) => void;
  recentLinks: RecentAttachmentLinkItem[];
  selectedFiles: File[];
  urlValue: string;
};

type HeaderProps = {
  onBack: () => void;
  onClose: () => void;
};

function AttachmentsHeader({ onBack, onClose }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <button
        aria-label="Quay lại menu thêm"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-base font-semibold">Đính kèm</p>
      <button
        aria-label="Đóng menu đính kèm"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

type FileSelectionSectionProps = {
  canWrite: boolean;
  isSubmitting: boolean;
  onRemoveSelectedFile: (index: number) => void;
  onSelectFiles: (files: File[]) => void;
  selectedFiles: File[];
};

function FileSelectionSection({
  canWrite,
  isSubmitting,
  onRemoveSelectedFile,
  onSelectFiles,
  selectedFiles,
}: FileSelectionSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        accept={FILE_ACCEPT}
        className="hidden"
        disabled={!canWrite || isSubmitting}
        multiple
        onChange={(event) => {
          const fileList = event.currentTarget.files;
          if (fileList && fileList.length > 0) {
            onSelectFiles(Array.from(fileList));
          }
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className="rounded-md border border-slate-600 bg-[#2a2d33] px-3 py-2.5">
        <p className="text-sm font-medium text-slate-100">Đính kèm tệp từ máy tính của bạn</p>
        <p className="mt-1 text-xs text-slate-400">Bạn cũng có thể kéo và thả tệp để tải chúng lên.</p>
        <button
          className="mt-2 inline-flex h-8 items-center rounded-md bg-slate-600/60 px-3 text-xs font-semibold text-slate-100 transition hover:bg-slate-500/70 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canWrite || isSubmitting}
          onClick={() => {
            fileInputRef.current?.click();
          }}
          type="button"
        >
          Chọn tệp
        </button>
      </div>

      {selectedFiles.length > 0 ? (
        <div className="space-y-1 rounded-md border border-slate-700 bg-[#252a33] p-2">
          {selectedFiles.map((file, index) => (
            <div className="flex items-center justify-between gap-2" key={`${file.name}:${file.size}:${file.lastModified}`}>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-100">{file.name}</p>
                <p className="text-[11px] text-slate-400">{formatAttachmentSize(file.size)}</p>
              </div>
              <button
                className="inline-flex h-7 items-center rounded-md border border-slate-600 px-2 text-[11px] text-slate-200 transition hover:bg-white/10"
                disabled={!canWrite || isSubmitting}
                onClick={() => {
                  onRemoveSelectedFile(index);
                }}
                type="button"
              >
                Bỏ
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

type RecentLinksSectionProps = {
  canWrite: boolean;
  isLoadingRecentLinks: boolean;
  isSubmitting: boolean;
  onPickRecentLink: (link: RecentAttachmentLinkItem) => void;
  recentLinks: RecentAttachmentLinkItem[];
};

function RecentLinksSection({
  canWrite,
  isLoadingRecentLinks,
  isSubmitting,
  onPickRecentLink,
  recentLinks,
}: RecentLinksSectionProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-300">Đã xem gần đây</p>
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
        {isLoadingRecentLinks ? (
          <div className="rounded-md border border-slate-600 bg-[#2a2d33] px-3 py-2">
            <LoadingInline label="Đang tải liên kết gần đây..." />
          </div>
        ) : recentLinks.length > 0 ? (
          recentLinks.map((link) => (
            <button
              className="flex w-full items-start gap-2 rounded-md border border-transparent bg-[#2a2d33] px-2.5 py-2 text-left transition hover:border-slate-500 hover:bg-[#303640]"
              disabled={!canWrite || isSubmitting}
              key={link.attachmentId}
              onClick={() => {
                onPickRecentLink(link);
              }}
              type="button"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-100">{link.title}</span>
                <span className="block truncate text-[11px] text-slate-400">{link.url}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{formatAttachmentTimestamp(link.createdAt)}</span>
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-md border border-slate-600 bg-[#2a2d33] px-3 py-2 text-xs text-slate-300">
            Chưa có liên kết gần đây.
          </p>
        )}
      </div>
    </div>
  );
}

type FooterProps = {
  canSubmit: boolean;
  canWrite: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

function AttachmentsFooter({
  canSubmit,
  canWrite,
  isSubmitting,
  onBack,
  onSubmit,
}: FooterProps) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-2.5">
      <button
        className="inline-flex h-8 items-center rounded-md border border-slate-600 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
        onClick={onBack}
        type="button"
      >
        Hủy
      </button>
      <button
        className="inline-flex h-8 items-center rounded-md bg-[#579dff] px-3 text-xs font-semibold text-slate-900 transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canWrite || isSubmitting || !canSubmit}
        onClick={onSubmit}
        type="button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Đang chèn...
          </>
        ) : (
          <>
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            Chèn
          </>
        )}
      </button>
    </div>
  );
}

export function AttachmentsPanel({
  canWrite,
  displayText,
  isLoadingRecentLinks,
  isSubmitting,
  onBack,
  onClose,
  onDisplayTextChange,
  onPickRecentLink,
  onRemoveSelectedFile,
  onSelectFiles,
  onSubmit,
  onUrlChange,
  recentLinks,
  selectedFiles,
  urlValue,
}: AttachmentsPanelProps) {
  const canSubmit = useMemo(() => {
    return selectedFiles.length > 0 || urlValue.trim().length > 0;
  }, [selectedFiles.length, urlValue]);

  return (
    <>
      <AttachmentsHeader onBack={onBack} onClose={onClose} />

      <div className="space-y-3 p-3">
        <FileSelectionSection
          canWrite={canWrite}
          isSubmitting={isSubmitting}
          onRemoveSelectedFile={onRemoveSelectedFile}
          onSelectFiles={onSelectFiles}
          selectedFiles={selectedFiles}
        />

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-300">Tìm kiếm hoặc dán liên kết *</p>
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            disabled={!canWrite || isSubmitting}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="Dán các liên kết gần đây hoặc dán mới..."
            value={urlValue}
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-300">Văn bản hiển thị (không bắt buộc)</p>
          <input
            className="h-9 w-full rounded-md border border-slate-600 bg-[#2a2d33] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#8eb7ff]"
            disabled={!canWrite || isSubmitting}
            maxLength={255}
            onChange={(event) => onDisplayTextChange(event.target.value)}
            placeholder="Văn bản cần hiển thị"
            value={displayText}
          />
        </div>

        <RecentLinksSection
          canWrite={canWrite}
          isLoadingRecentLinks={isLoadingRecentLinks}
          isSubmitting={isSubmitting}
          onPickRecentLink={onPickRecentLink}
          recentLinks={recentLinks}
        />
      </div>

      <AttachmentsFooter
        canSubmit={canSubmit}
        canWrite={canWrite}
        isSubmitting={isSubmitting}
        onBack={onBack}
        onSubmit={onSubmit}
      />

      {!canWrite ? (
        <p className="border-t border-white/10 px-3 py-2 text-[11px] text-slate-400">Read-only mode: attachment updates are disabled.</p>
      ) : null}
    </>
  );
}
