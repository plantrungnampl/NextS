"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionHeading } from "../components";
import type { HomeContent } from "../data/home-content";
import type { TestimonialItem } from "../types";

const AUTO_ROTATE_MS = 6000;

function resolveWindow(items: ReadonlyArray<TestimonialItem>, startIndex: number, count: number) {
  return Array.from({ length: count }, (_, offset) => {
    const index = (startIndex + offset) % items.length;

    return items[index];
  });
}

function DesktopTestimonials({
  items,
  activeIndex,
}: {
  items: ReadonlyArray<TestimonialItem>;
  activeIndex: number;
}) {
  return (
    <div className="hidden gap-6 lg:grid lg:grid-cols-3">
      {items.map((item, itemIndex) => (
        <m.article
          key={`${item.name}-${activeIndex}-${itemIndex}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: itemIndex * 0.07 }}
          className="rounded-[16px] border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-6 shadow-[0_8px_24px_rgba(9,30,66,0.08)]"
        >
          <p className="text-base leading-8 text-[var(--home-text-secondary)]">“{item.quote}”</p>
          <footer className="mt-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#0079BF] to-[#00C4B4] text-sm font-bold text-white">
              {item.avatar}
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--home-text-primary)]">{item.name}</p>
              <p className="text-sm text-[var(--home-text-secondary)]">
                {item.role} · {item.company}
              </p>
            </div>
          </footer>
        </m.article>
      ))}
    </div>
  );
}

function MobileTestimonials({
  item,
  activeIndex,
}: {
  item: TestimonialItem;
  activeIndex: number;
}) {
  return (
    <div className="lg:hidden">
      <AnimatePresence mode="wait">
        <m.article
          key={`${item.name}-${activeIndex}`}
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -22 }}
          transition={{ duration: 0.28 }}
          className="rounded-[16px] border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-5 shadow-[0_8px_24px_rgba(9,30,66,0.08)]"
        >
          <p className="text-base leading-7 text-[var(--home-text-secondary)]">“{item.quote}”</p>
          <footer className="mt-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#0079BF] to-[#00C4B4] text-xs font-bold text-white">
              {item.avatar}
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--home-text-primary)]">{item.name}</p>
              <p className="text-sm text-[var(--home-text-secondary)]">
                {item.role} · {item.company}
              </p>
            </div>
          </footer>
        </m.article>
      </AnimatePresence>
    </div>
  );
}

function TestimonialsControls({
  activeIndex,
  items,
  dotAriaLabel,
  previousAriaLabel,
  nextAriaLabel,
  onSelect,
  onPrevious,
  onNext,
}: {
  activeIndex: number;
  items: ReadonlyArray<TestimonialItem>;
  dotAriaLabel: string;
  previousAriaLabel: string;
  nextAriaLabel: string;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {items.map((testimonial, testimonialIndex) => (
          <button
            key={testimonial.name}
            type="button"
            aria-label={`${dotAriaLabel} ${testimonialIndex + 1}`}
            onClick={() => onSelect(testimonialIndex)}
            className={`h-2.5 rounded-full transition-all duration-180 ${
              testimonialIndex === activeIndex
                ? "w-8 bg-[#0079BF]"
                : "w-4 bg-[#C7D1DB] hover:bg-[#99A9BA]"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={previousAriaLabel}
          onClick={onPrevious}
          className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--home-border-soft)] bg-[var(--home-surface)] text-[var(--home-text-secondary)] transition-colors duration-180 hover:text-[var(--home-text-primary)]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label={nextAriaLabel}
          onClick={onNext}
          className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--home-border-soft)] bg-[var(--home-surface)] text-[var(--home-text-secondary)] transition-colors duration-180 hover:text-[var(--home-text-primary)]"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

type TestimonialsSectionProps = {
  content: HomeContent["testimonials"];
};

export function TestimonialsSection({ content }: TestimonialsSectionProps) {
  const items = content.items;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || items.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((previousValue) => (previousValue + 1) % items.length);
    }, AUTO_ROTATE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPaused, items.length]);

  if (items.length === 0) {
    return null;
  }

  const desktopWindow = resolveWindow(items, activeIndex, 3);

  return (
    <section id="testimonials" className="mx-auto w-full max-w-[1200px] px-6 py-20">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <div
        className="mt-10"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <LazyMotion features={domAnimation}>
          <DesktopTestimonials items={desktopWindow} activeIndex={activeIndex} />
          <MobileTestimonials item={items[activeIndex]} activeIndex={activeIndex} />
        </LazyMotion>

        <TestimonialsControls
          activeIndex={activeIndex}
          items={items}
          dotAriaLabel={content.dotAriaLabel}
          previousAriaLabel={content.previousAriaLabel}
          nextAriaLabel={content.nextAriaLabel}
          onSelect={setActiveIndex}
          onPrevious={() =>
            setActiveIndex((previousValue) =>
              previousValue === 0 ? items.length - 1 : previousValue - 1,
            )
          }
          onNext={() => setActiveIndex((previousValue) => (previousValue + 1) % items.length)}
        />
      </div>
    </section>
  );
}
