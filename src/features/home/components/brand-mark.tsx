import type { UiTheme } from "../types";

type BrandMarkProps = {
  theme: UiTheme;
};

export function BrandMark({ theme }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${theme.brandBadgeClass}`}
      >
        NB
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          NextS
        </p>
        <p className="text-lg font-bold tracking-tight text-slate-900">NexaBoard</p>
      </div>
    </div>
  );
}
