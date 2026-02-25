type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: SectionHeadingProps) {
  return (
    <header className={centered ? "text-center" : ""}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--home-text-secondary)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--home-text-primary)] md:text-[3rem] md:leading-[1.1]">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-[720px] text-base leading-8 text-[var(--home-text-secondary)] md:text-lg">
          {description}
        </p>
      ) : null}
    </header>
  );
}
