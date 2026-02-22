"use client";

import {
  ChevronLeft,
  Copy,
  ExternalLink,
  FileJson,
  Link2,
  Mail,
  Printer,
  QrCode,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

type CardSharePanelProps = {
  boardId: string;
  cardId: string;
  cardTitle: string;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCardPath(pathname: string, cardId: string): string {
  const params = new URLSearchParams();
  params.set("c", cardId);
  return `${pathname}?${params.toString()}`;
}

async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Không thể sao chép nội dung.");
  }
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
      onClick={onClick}
      type="button"
    >
      <span className="text-slate-300">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ReadonlyField({
  value,
  onCopy,
}: {
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex h-9 items-center rounded-md border border-slate-500/70 bg-[#252a33] pl-2 pr-1">
      <span className="truncate text-sm text-slate-200">{value}</span>
      <button
        aria-label="Sao chép"
        className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
        onClick={onCopy}
        type="button"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-slate-300">{children}</p>;
}

// eslint-disable-next-line max-lines-per-function
export function CardSharePanel({
  boardId,
  cardId,
  cardTitle,
  onOpenChange,
  workspaceSlug,
}: CardSharePanelProps) {
  const pathname = usePathname();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [showQr, setShowQr] = useState(false);

  const cardPath = useMemo(() => buildCardPath(pathname, cardId), [cardId, pathname]);
  const cardUrl = useMemo(
    () => (origin.length > 0 ? `${origin}${cardPath}` : cardPath),
    [cardPath, origin],
  );
  const embedHtml = useMemo(() => {
    const safeTitle = escapeHtml(cardTitle);
    return `<blockquote class="trello-card"><a href="${cardUrl}">${safeTitle}</a></blockquote><script src="https://p.trellocdn.com/embed.min.js"></script>`;
  }, [cardTitle, cardUrl]);
  const mailtoLink = useMemo(() => {
    const subject = encodeURIComponent(`Card: ${cardTitle}`);
    const body = encodeURIComponent(`${cardTitle}\n${cardUrl}`);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [cardTitle, cardUrl]);
  const cardJson = useMemo(
    () =>
      JSON.stringify(
        {
          boardId,
          cardId,
          title: cardTitle,
          type: "board_card_share",
          url: cardUrl,
          workspaceSlug,
        },
        null,
        2,
      ),
    [boardId, cardId, cardTitle, cardUrl, workspaceSlug],
  );
  const qrImageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(cardUrl)}`,
    [cardUrl],
  );

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <button
          aria-label="Quay lại"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-100">Mở rộng...</p>
        <button
          aria-label="Đóng"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-0.5">
        <ActionRow
          icon={<Printer className="h-4 w-4" />}
          label="In..."
          onClick={() => {
            window.print();
          }}
        />
        <ActionRow
          icon={<FileJson className="h-4 w-4" />}
          label="Xuất ra định dạng JSON"
          onClick={() => {
            void copyToClipboard(cardJson, "Đã sao chép JSON chia sẻ.");
          }}
        />
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <SectionTitle>Đường dẫn đến thẻ này 🔒</SectionTitle>
        <ReadonlyField
          onCopy={() => {
            void copyToClipboard(cardUrl, "Đã sao chép liên kết thẻ.");
          }}
          value={cardUrl}
        />
        <button
          className="inline-flex items-center gap-1 text-sm text-sky-300 transition hover:text-sky-200"
          onClick={() => {
            setShowQr((previous) => !previous);
          }}
          type="button"
        >
          <QrCode className="h-3.5 w-3.5" />
          {showQr ? "Ẩn Mã QR" : "Hiển thị Mã QR"}
        </button>
        {showQr ? (
          <div className="rounded-md border border-white/10 bg-white p-2">
            <img
              alt="QR code for card link"
              className="h-28 w-28"
              src={qrImageUrl}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <SectionTitle>Nhúng thẻ này</SectionTitle>
        <ReadonlyField
          onCopy={() => {
            void copyToClipboard(embedHtml, "Đã sao chép mã HTML nhúng.");
          }}
          value={embedHtml}
        />
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <SectionTitle>Gửi mail cho thẻ này</SectionTitle>
        <ReadonlyField
          onCopy={() => {
            void copyToClipboard(mailtoLink, "Đã sao chép mailto link.");
          }}
          value={mailtoLink}
        />
        <a
          className="inline-flex items-center gap-1 text-sm text-sky-300 transition hover:text-sky-200"
          href={mailtoLink}
        >
          <Mail className="h-3.5 w-3.5" />
          Mở ứng dụng mail
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <SectionTitle>Nhúng thẻ vào site</SectionTitle>
        <ReadonlyField
          onCopy={() => {
            void copyToClipboard(cardPath, "Đã sao chép đường dẫn tương đối.");
          }}
          value={cardPath}
        />
        <p className="text-xs text-slate-400">
          Dạng ngắn gọn để chèn nội bộ workspace.
        </p>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <SectionTitle>Liên kết nhanh</SectionTitle>
        <a
          className="inline-flex items-center gap-1 text-sm text-sky-300 transition hover:text-sky-200"
          href={cardUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Link2 className="h-3.5 w-3.5" />
          Mở thẻ trong tab mới
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
