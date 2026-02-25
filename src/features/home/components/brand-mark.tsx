type BrandMarkProps = {
  href: string;
  ariaLabel: string;
  iconLabel: string;
  name: string;
  subtitle: string;
};

export function BrandMark({ href, ariaLabel, iconLabel, name, subtitle }: BrandMarkProps) {
  return (
    <a href={href} className="inline-flex items-center gap-3" aria-label={ariaLabel}>
      <span className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-[#0079BF] to-[#00C4B4] text-sm font-black text-white shadow-[0_8px_20px_rgba(0,121,191,0.35)]">
        {iconLabel}
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-extrabold tracking-[-0.02em] text-[var(--home-text-primary)]">
          {name}
        </span>
        <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--home-text-secondary)]">
          {subtitle}
        </span>
      </span>
    </a>
  );
}
