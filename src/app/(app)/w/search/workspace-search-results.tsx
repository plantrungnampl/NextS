"use client";

import Link from "next/link";

import { Badge, Button } from "@/components/ui";

import type { SearchResponsePayload, SearchResultItem } from "./search-types";

const ENTITY_LABEL: Record<SearchResultItem["entityType"], string> = {
  attachment: "Tệp đính kèm",
  board: "Bảng",
  card: "Thẻ",
  checklist: "Checklist",
  comment: "Bình luận",
};

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Không rõ thời gian";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không rõ thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SearchResultRow({ item }: { item: SearchResultItem }) {
  return (
    <Link
      className="block rounded-lg border border-slate-700 bg-[#121824] px-4 py-3 transition-colors hover:border-sky-400/70 hover:bg-[#151d2b]"
      href={item.href}
      prefetch={false}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100">{item.title}</p>
          <p className="text-xs text-slate-400">
            {item.workspace.name}
            {item.board ? ` • ${item.board.name}` : ""}
            {item.card ? ` • ${item.card.title}` : ""}
          </p>
        </div>
        <Badge className="border-slate-600 bg-slate-800 text-[11px] text-slate-300" variant="outline">
          {ENTITY_LABEL[item.entityType]}
        </Badge>
      </div>
      {item.snippet ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-300">{item.snippet}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">Cập nhật: {formatUpdatedAt(item.updatedAt)}</p>
    </Link>
  );
}

function SearchResultsEmpty({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#121824] px-4 py-6 text-sm text-slate-400">
      Không có kết quả nào cho “{query}”.
    </div>
  );
}

export function WorkspaceSearchResults({
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  items,
  loadMoreRef,
  onLoadMore,
  query,
  responseMeta,
}: {
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  items: SearchResultItem[];
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  query: string;
  responseMeta: SearchResponsePayload["appliedFilters"] | null;
}) {
  if (query.trim().length < 2) {
    return (
      <div className="rounded-lg border border-slate-700 bg-[#121824] px-4 py-6 text-sm text-slate-400">
        Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-[#121824] px-4 py-6 text-sm text-slate-300">
        Đang tìm kiếm...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 px-4 py-6 text-sm text-rose-200">
        Không thể tải kết quả tìm kiếm. Vui lòng thử lại.
      </div>
    );
  }

  if (items.length < 1) {
    return <SearchResultsEmpty query={query} />;
  }

  return (
    <section className="space-y-3">
      {responseMeta?.boardsHiddenByCardFilters ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          Đang ẩn kết quả Bảng vì bạn bật bộ lọc dành riêng cho thẻ.
        </p>
      ) : null}
      <div className="space-y-2">
        {items.map((item) => (
          <SearchResultRow item={item} key={item.id} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="h-1 w-full" ref={loadMoreRef} />
        {hasNextPage ? (
          <Button
            className="h-9"
            onClick={onLoadMore}
            type="button"
            variant="ghost"
          >
            {isFetchingNextPage ? "Đang tải thêm..." : "Tải thêm"}
          </Button>
        ) : (
          <p className="text-xs text-slate-500">Đã hiển thị tất cả kết quả.</p>
        )}
      </div>
    </section>
  );
}
