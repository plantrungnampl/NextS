"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APP_ROUTES } from "@/core";

import type { SearchResponsePayload, SearchResultItem } from "../w/search/search-types";

const SEARCH_INPUT_MIN_LENGTH = 2;
const SEARCH_PREVIEW_LIMIT = 8;
const SEARCH_DROPDOWN_ID = "header-quick-search-listbox";
const SEARCH_DEBOUNCE_MS = 280;

const ENTITY_LABEL: Record<SearchResultItem["entityType"], string> = {
  attachment: "Tệp",
  board: "Bảng",
  card: "Thẻ",
  checklist: "Checklist",
  comment: "Bình luận",
};

function buildSearchPageHref(inputValue: string): string {
  const query = inputValue.trim();
  if (query.length < 1) {
    return APP_ROUTES.workspace.search;
  }

  const params = new URLSearchParams();
  params.set("q", query.slice(0, 120));
  return `${APP_ROUTES.workspace.search}?${params.toString()}`;
}

function resolveActiveIndex(activeIndex: number, itemsLength: number): number {
  if (itemsLength < 1) {
    return -1;
  }

  if (activeIndex < 0) {
    return 0;
  }

  if (activeIndex >= itemsLength) {
    return itemsLength - 1;
  }

  return activeIndex;
}

function useDebouncedValue(inputValue: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(inputValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, inputValue]);

  return debouncedValue;
}

function useOutsideClickClose(params: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  open: boolean;
}) {
  useEffect(() => {
    if (!params.open) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (params.containerRef.current?.contains(target)) {
        return;
      }

      params.onClose();
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [params.containerRef, params.onClose, params.open]);
}

function useQuickSearchPreview(params: {
  normalizedQuery: string;
  open: boolean;
}) {
  const previewQuery = useQuery<SearchResponsePayload>({
    enabled: params.open && params.normalizedQuery.length >= SEARCH_INPUT_MIN_LENGTH,
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(SEARCH_PREVIEW_LIMIT));
      queryParams.set("q", params.normalizedQuery);

      const response = await fetch(`/api/search/workspace?${queryParams.toString()}`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("QUICK_SEARCH_FAILED");
      }

      return (await response.json()) as SearchResponsePayload;
    },
    queryKey: ["header-quick-search", params.normalizedQuery],
    retry: 1,
    staleTime: 15_000,
  });

  const items = useMemo(
    () => previewQuery.data?.items ?? [],
    [previewQuery.data?.items],
  );

  return {
    isError: previewQuery.isError,
    isLoading: previewQuery.isLoading || previewQuery.isFetching,
    items,
  };
}

function formatWorkspaceSubtitle(item: SearchResultItem): string {
  const base = item.workspace.name;
  if (item.board && item.card) {
    return `${base} • ${item.board.name} • ${item.card.title}`;
  }
  if (item.board) {
    return `${base} • ${item.board.name}`;
  }
  return base;
}

function GuidancePanel() {
  return (
    <div className="space-y-1 p-3 text-xs text-slate-400">
      <p className="font-medium text-slate-300">Tìm nhanh trong workspace</p>
      <p>Nhập ít nhất 2 ký tự để xem kết quả nhanh.</p>
      <p>Enter: mở trang tìm kiếm, Esc: đóng bảng gợi ý.</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="space-y-1 p-3 text-xs text-slate-400">
      <p className="font-medium text-slate-300">Đang tìm kiếm...</p>
    </div>
  );
}

function ErrorPanel() {
  return (
    <div className="space-y-1 p-3 text-xs text-rose-200">
      <p className="font-medium">Không tải được kết quả nhanh.</p>
      <p className="text-rose-100/80">Bạn có thể nhấn Enter để mở trang tìm kiếm đầy đủ.</p>
    </div>
  );
}

function EmptyPanel({ query }: { query: string }) {
  return (
    <div className="space-y-1 p-3 text-xs text-slate-400">
      <p className="font-medium text-slate-300">Không có kết quả cho “{query}”.</p>
      <p>Nhấn Enter để mở trang tìm kiếm đầy đủ với bộ lọc nâng cao.</p>
    </div>
  );
}

function ResultRow(params: {
  active: boolean;
  index: number;
  item: SearchResultItem;
  onHover: (index: number) => void;
  onSelect: (href: string) => void;
}) {
  return (
    <li role="presentation">
      <button
        aria-selected={params.active}
        className={`w-full rounded-md border px-2 py-2 text-left transition-colors ${
          params.active
            ? "border-sky-500/60 bg-sky-500/10"
            : "border-transparent hover:border-slate-600 hover:bg-slate-800/60"
        }`}
        id={`header-quick-search-option-${params.index}`}
        onClick={() => params.onSelect(params.item.href)}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onMouseEnter={() => params.onHover(params.index)}
        role="option"
        type="button"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-xs font-semibold text-slate-100">{params.item.title}</p>
          <span className="rounded border border-slate-600 bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-300">
            {ENTITY_LABEL[params.item.entityType]}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{formatWorkspaceSubtitle(params.item)}</p>
      </button>
    </li>
  );
}

function ResultList(params: {
  activeIndex: number;
  items: SearchResultItem[];
  onHover: (index: number) => void;
  onSelect: (href: string) => void;
}) {
  return (
    <ul className="max-h-[360px] space-y-1 overflow-y-auto p-2" id={SEARCH_DROPDOWN_ID} role="listbox">
      {params.items.map((item, index) => (
        <ResultRow
          active={params.activeIndex === index}
          index={index}
          item={item}
          key={item.id}
          onHover={params.onHover}
          onSelect={params.onSelect}
        />
      ))}
    </ul>
  );
}

function DropdownContent(params: {
  activeIndex: number;
  isError: boolean;
  isLoading: boolean;
  items: SearchResultItem[];
  normalizedQuery: string;
  onHover: (index: number) => void;
  onSelect: (href: string) => void;
}) {
  if (params.normalizedQuery.length < SEARCH_INPUT_MIN_LENGTH) {
    return <GuidancePanel />;
  }

  if (params.isLoading) {
    return <LoadingPanel />;
  }

  if (params.isError) {
    return <ErrorPanel />;
  }

  if (params.items.length < 1) {
    return <EmptyPanel query={params.normalizedQuery} />;
  }

  return (
    <ResultList
      activeIndex={params.activeIndex}
      items={params.items}
      onHover={params.onHover}
      onSelect={params.onSelect}
    />
  );
}

function SearchInputField(params: {
  activeIndex: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  open: boolean;
  value: string;
}) {
  return (
    <>
      <label className="sr-only" htmlFor="header-workspace-search-input">Tìm kiếm workspace</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          aria-activedescendant={params.activeIndex >= 0 ? `header-quick-search-option-${params.activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={SEARCH_DROPDOWN_ID}
          aria-expanded={params.open}
          className="h-9 w-full max-w-[600px] rounded-md border border-slate-600 bg-[#11161f] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-500"
          id="header-workspace-search-input"
          onChange={(event) => {
            params.onChange(event.target.value);
          }}
          onFocus={params.onFocus}
          onKeyDown={params.onKeyDown}
          placeholder="Tìm kiếm"
          role="combobox"
          type="search"
          value={params.value}
        />
      </div>
    </>
  );
}

function HeaderWorkspaceSearchInner({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQueryInput = useDebouncedValue(queryInput, SEARCH_DEBOUNCE_MS);
  const normalizedQuery = debouncedQueryInput.trim();

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useOutsideClickClose({
    containerRef,
    onClose: closeDropdown,
    open,
  });

  const preview = useQuickSearchPreview({
    normalizedQuery,
    open,
  });

  const effectiveActiveIndex = resolveActiveIndex(activeIndex, preview.items.length);

  const navigateToSearchPage = useCallback((inputQuery: string) => {
    closeDropdown();
    router.push(buildSearchPageHref(inputQuery));
  }, [closeDropdown, router]);

  const navigateToItem = useCallback((href: string) => {
    closeDropdown();
    router.push(href);
  }, [closeDropdown, router]);

  const onInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      }
      if (preview.items.length < 1) {
        return;
      }
      setActiveIndex((current) => {
        const normalized = resolveActiveIndex(current, preview.items.length);
        const next = normalized + 1;
        return next >= preview.items.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      }
      if (preview.items.length < 1) {
        return;
      }
      setActiveIndex((current) => {
        const normalized = resolveActiveIndex(current, preview.items.length);
        const next = normalized - 1;
        return next < 0 ? preview.items.length - 1 : next;
      });
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const highlightedItem = effectiveActiveIndex >= 0 ? preview.items[effectiveActiveIndex] : null;
    if (highlightedItem) {
      navigateToItem(highlightedItem.href);
      return;
    }

    navigateToSearchPage(queryInput);
  }, [closeDropdown, effectiveActiveIndex, navigateToItem, navigateToSearchPage, open, preview.items, queryInput]);

  return (
    <div className="relative min-w-0 flex-1" ref={containerRef}>
      <SearchInputField
        activeIndex={effectiveActiveIndex}
        onChange={setQueryInput}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={onInputKeyDown}
        open={open}
        value={queryInput}
      />

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full max-w-[600px] rounded-md border border-slate-700 bg-[#131a26] shadow-xl">
          <DropdownContent
            activeIndex={effectiveActiveIndex}
            isError={preview.isError}
            isLoading={preview.isLoading}
            items={preview.items}
            normalizedQuery={normalizedQuery}
            onHover={setActiveIndex}
            onSelect={navigateToItem}
          />
          <div className="border-t border-slate-700 px-3 py-2 text-[11px] text-slate-500">
            Nhấn Enter để mở trang tìm kiếm đầy đủ.
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HeaderWorkspaceSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchSnapshot = searchParams.toString();

  const initialQuery = useMemo(() => {
    if (pathname !== APP_ROUTES.workspace.search) {
      return "";
    }

    return new URLSearchParams(searchSnapshot).get("q") ?? "";
  }, [pathname, searchSnapshot]);

  const remountKey = pathname === APP_ROUTES.workspace.search
    ? `header-search:${searchSnapshot}`
    : `header-search:${pathname}`;

  return <HeaderWorkspaceSearchInner initialQuery={initialQuery} key={remountKey} />;
}
