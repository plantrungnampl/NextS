"use client";

export function ListColumnMetaRow({
  hiddenCardCount,
  listId,
  loadMoreStep,
  onLoadMoreCards,
  totalCount,
  visibleCount,
}: {
  hiddenCardCount: number;
  listId: string;
  loadMoreStep: number;
  onLoadMoreCards: (listId: string) => void;
  totalCount: number;
  visibleCount: number;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 px-1">
      <p className="text-[11px] text-slate-400">
        Showing {visibleCount} / {totalCount}
      </p>
      {hiddenCardCount > 0 ? (
        <button
          className="inline-flex min-h-8 items-center rounded-lg border border-white/15 bg-slate-900/70 px-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800/80"
          onClick={() => onLoadMoreCards(listId)}
          type="button"
        >
          Load {Math.min(loadMoreStep, hiddenCardCount)} more
        </button>
      ) : null}
    </div>
  );
}
