import { Globe, Linkedin, Twitter, Youtube } from "lucide-react";

import { BrandMark } from "../components";
import type { HomeContent } from "../data/home-content";

type FooterSectionProps = {
  content: HomeContent;
};

export function FooterSection({ content }: FooterSectionProps) {
  return (
    <footer
      id="footer"
      className="border-t border-[var(--home-border-soft)] bg-[var(--home-surface)]/88"
    >
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-14 lg:grid-cols-[1.1fr_3fr]">
        <div>
          <BrandMark
            href={content.brand.homeHref}
            ariaLabel={content.brand.homeAriaLabel}
            iconLabel={content.brand.iconLabel}
            name={content.brand.name}
            subtitle={content.brand.subtitle}
          />
          <p className="mt-4 max-w-[320px] text-sm leading-7 text-[var(--home-text-secondary)]">
            {content.footer.description}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {[Twitter, Linkedin, Youtube].map((Icon, index) => (
              <a
                key={`social-${index + 1}`}
                href="#"
                aria-label={content.footer.socialAriaLabel}
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--home-border-soft)] text-[var(--home-text-secondary)] transition-colors duration-180 hover:text-[var(--home-text-primary)]"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {content.footer.groups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--home-text-primary)]">
                {group.title}
              </p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--home-text-secondary)] transition-colors duration-180 hover:text-[var(--home-text-primary)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--home-border-soft)] bg-[var(--home-surface)]/84">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-2 px-6 py-4 text-sm text-[var(--home-text-secondary)]">
          <p>{content.footer.copyright}</p>
          <span className="inline-flex items-center gap-1">
            <Globe className="size-4" />
            {content.brand.localeDisplayLabel}
          </span>
        </div>
      </div>
    </footer>
  );
}
