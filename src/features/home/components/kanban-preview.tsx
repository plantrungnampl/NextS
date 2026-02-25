import type { BoardColumnPreview } from "../types";

type KanbanPreviewProps = {
  columns: ReadonlyArray<BoardColumnPreview>;
  liveBadge: string;
  className?: string;
};

const avatarToneClassNames = [
  "bg-[#0079BF]/18 text-[#005A8C]",
  "bg-[#00C4B4]/20 text-[#036E67]",
  "bg-[#FFAB00]/20 text-[#7A4E00]",
  "bg-[#6E5DC6]/18 text-[#3E3486]",
] as const;

export function KanbanPreview({ columns, liveBadge, className }: KanbanPreviewProps) {
  return (
    <div
      className={`rounded-[20px] border border-[var(--home-border-soft)] bg-[var(--home-surface)]/95 p-4 shadow-[var(--home-shadow-popover)] backdrop-blur-sm md:p-5 ${className ?? ""}`.trim()}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--home-text-secondary)]">
          Live board preview
        </p>
        <span className="inline-flex items-center rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#136F3A]">
          {liveBadge}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {columns.map((column) => (
          <article
            key={column.title}
            className="rounded-[16px] border border-[#D9E2EC] bg-[#F7FAFC] p-3 dark:bg-[#0F172A]"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--home-text-primary)]">{column.title}</p>
              <span className="rounded-full bg-[var(--home-surface)] px-2 py-1 text-xs font-semibold text-[var(--home-text-secondary)]">
                {column.cardCount}
              </span>
            </div>
            <div className="space-y-2.5">
              {column.cards.map((card) => (
                <article
                  key={`${column.title}-${card.title}`}
                  className="home-kanban-card rounded-[14px] border border-[#DFE1E6] bg-[var(--home-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--home-text-primary)]">{card.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${card.labelClassName}`}>
                      {card.label}
                    </span>
                    <span className="rounded-md bg-[#F4F5F7] px-2 py-1 text-xs font-semibold text-[var(--home-text-secondary)]">
                      {card.checklist}
                    </span>
                    <span className="rounded-md bg-[#FFF4E5] px-2 py-1 text-xs font-semibold text-[#8A4B00]">
                      {card.dueDate}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex -space-x-1.5">
                      {card.members.map((member, memberIndex) => (
                        <span
                          key={`${card.title}-${member}`}
                          className={`grid size-6 place-items-center rounded-full border border-white text-[10px] font-bold ${avatarToneClassNames[memberIndex % avatarToneClassNames.length]}`}
                        >
                          {member}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-[var(--home-text-secondary)]">● updated now</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
