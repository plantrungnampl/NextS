import type { BoardColumn, UiTheme } from "../types";

type BoardColumnPanelProps = {
  column: BoardColumn;
  toneClass: string;
  theme: UiTheme;
};

export function BoardColumnPanel({
  column,
  toneClass,
  theme,
}: BoardColumnPanelProps) {
  return (
    <article className={`rounded-2xl p-3 shadow-sm backdrop-blur ${theme.panelSurfaceClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{column.title}</p>
        <span className={`h-2.5 w-12 rounded-full bg-gradient-to-r ${toneClass}`} />
      </div>
      <div className="space-y-2">
        {column.cards.map((card) => (
          <article
            key={`${column.title}-${card.title}`}
            className="shine-on-hover rounded-xl border border-slate-200 bg-white p-3 transition duration-200"
          >
            <p className="text-sm font-semibold text-slate-800">{card.title}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {card.tag}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                {card.owner}
              </span>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}
