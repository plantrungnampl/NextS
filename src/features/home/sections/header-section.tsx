"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { APP_ROUTES } from "@/core";

import { BrandMark, ButtonLink } from "../components";
import type { HomeContent } from "../data/home-content";

type HeaderContent = Pick<HomeContent, "brand" | "header" | "navLinks">;

type HeaderSectionProps = {
  content: HeaderContent;
};

type SharedAuthActionsProps = {
  content: HeaderContent;
};

function LandingUserButton({ homeHref }: { homeHref: string }) {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--home-border-soft)] bg-[var(--home-surface)]">
      <UserButton
        afterSignOutUrl={homeHref}
        appearance={{
          elements: {
            avatarBox: "h-10 w-10",
            userButtonTrigger: "h-10 w-10 rounded-full border-0 p-0",
          },
        }}
      />
    </div>
  );
}

function DesktopAuthActions({ content }: SharedAuthActionsProps) {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <ButtonLink
        href={content.brand.localeSwitchHref}
        variant="ghost"
        className="min-h-[44px] px-3 text-xs uppercase tracking-[0.12em]"
      >
        {content.brand.localeSwitchLabel}
      </ButtonLink>

      <SignedOut>
        <div className="flex items-center gap-2">
          <ButtonLink href={APP_ROUTES.login} variant="ghost" className="min-h-[44px] px-4 text-sm">
            {content.header.loginLabel}
          </ButtonLink>
          <ButtonLink href={APP_ROUTES.login} className="min-h-[48px] text-sm">
            {content.header.getStartedLabel}
          </ButtonLink>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-2">
          <ButtonLink href={APP_ROUTES.workspace.index} className="min-h-[48px] text-sm">
            {content.header.workspaceLabel}
          </ButtonLink>
          <LandingUserButton homeHref={content.brand.homeHref} />
        </div>
      </SignedIn>
    </div>
  );
}

function MobileAuthActions({ content }: SharedAuthActionsProps) {
  return (
    <div className="mt-4 grid gap-2 border-t border-[var(--home-border-soft)] pt-4">
      <ButtonLink href={content.brand.localeSwitchHref} variant="ghost" className="w-full text-sm">
        {content.brand.localeSwitchLabel}
      </ButtonLink>

      <SignedOut>
        <div className="grid gap-2">
          <ButtonLink href={APP_ROUTES.login} variant="ghost" className="w-full text-sm">
            {content.header.loginLabel}
          </ButtonLink>
          <ButtonLink href={APP_ROUTES.login} className="w-full text-sm">
            {content.header.getStartedLabel}
          </ButtonLink>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="grid gap-2">
          <ButtonLink href={APP_ROUTES.workspace.index} className="w-full text-sm">
            {content.header.workspaceLabel}
          </ButtonLink>
          <div className="mx-auto">
            <LandingUserButton homeHref={content.brand.homeHref} />
          </div>
        </div>
      </SignedIn>
    </div>
  );
}

export function HeaderSection({ content }: HeaderSectionProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-[var(--home-border-soft)] transition-colors duration-220 ${
        isScrolled
          ? "bg-[var(--home-surface)]/92 backdrop-blur-xl"
          : "bg-[var(--home-surface)]/72 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 py-4">
        <div className="flex min-h-[48px] items-center justify-between gap-4">
          <BrandMark
            href={content.brand.homeHref}
            ariaLabel={content.brand.homeAriaLabel}
            iconLabel={content.brand.iconLabel}
            name={content.brand.name}
            subtitle={content.brand.subtitle}
          />

          <nav
            aria-label={content.header.primaryNavAriaLabel}
            className="hidden items-center gap-2 lg:flex"
          >
            {content.navLinks.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-[var(--home-text-secondary)] transition-colors duration-180 hover:bg-[var(--home-surface)] hover:text-[var(--home-text-primary)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <DesktopAuthActions content={content} />

          <button
            type="button"
            aria-expanded={isMobileOpen}
            aria-label={
              isMobileOpen
                ? content.header.closeMenuAriaLabel
                : content.header.openMenuAriaLabel
            }
            onClick={() => setIsMobileOpen((previousValue) => !previousValue)}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--home-border-soft)] text-[var(--home-text-primary)] transition-colors duration-180 hover:bg-[var(--home-surface)] lg:hidden"
          >
            {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div
          className={`home-mobile-menu overflow-hidden transition-[max-height,opacity] duration-220 ease-out lg:hidden ${
            isMobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav
            aria-label={content.header.mobileNavAriaLabel}
            className="mt-3 rounded-2xl border border-[var(--home-border-soft)] bg-[var(--home-surface)] p-3"
          >
            <div className="grid gap-1">
              {content.navLinks.map((item) => (
                <a
                  key={`mobile-${item.id}`}
                  href={item.href}
                  className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-[var(--home-text-secondary)] transition-colors duration-180 hover:bg-[#F4F5F7] hover:text-[var(--home-text-primary)]"
                  onClick={() => setIsMobileOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <MobileAuthActions content={content} />
          </nav>
        </div>
      </div>
    </header>
  );
}
