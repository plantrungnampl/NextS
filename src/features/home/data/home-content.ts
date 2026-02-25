import type { Metadata } from "next";

import type { HomeLocale } from "../types";
import { homeContentEn } from "./home-content-en";
import type { HomeContent } from "./home-content.schema";
import { homeContentVi } from "./home-content-vi";

const contentByLocale: Record<HomeLocale, HomeContent> = {
  en: homeContentEn,
  vi: homeContentVi,
};

export type { HomeContent };

export function getHomeContent(locale: HomeLocale): HomeContent {
  return contentByLocale[locale] ?? contentByLocale.en;
}

export function getHomeMetadata(locale: HomeLocale): Metadata {
  return contentByLocale[locale]?.metadata ?? contentByLocale.en.metadata;
}
