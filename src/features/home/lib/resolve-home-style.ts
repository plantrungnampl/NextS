import { getFirstQueryParamValue, isPromise } from "@/shared";

import {
  HOME_DEFAULT_STYLE,
  HOME_STYLE_QUERY_KEY,
  isSupportedHomeStyle,
} from "../config";
import type { HomePageProps, HomePageSearchParams, UiStyle } from "../types";

const EMPTY_SEARCH_PARAMS: HomePageSearchParams = {};

async function resolveSearchParams(
  searchParams: HomePageProps["searchParams"],
): Promise<HomePageSearchParams> {
  if (!searchParams) {
    return EMPTY_SEARCH_PARAMS;
  }

  if (isPromise<HomePageSearchParams>(searchParams)) {
    return (await searchParams) ?? EMPTY_SEARCH_PARAMS;
  }

  return searchParams;
}

export async function resolveHomeStyle(
  searchParams: HomePageProps["searchParams"],
): Promise<UiStyle> {
  const params = await resolveSearchParams(searchParams);
  const styleParam = getFirstQueryParamValue(params[HOME_STYLE_QUERY_KEY]);

  if (!styleParam) {
    return HOME_DEFAULT_STYLE;
  }

  return isSupportedHomeStyle(styleParam) ? styleParam : HOME_DEFAULT_STYLE;
}
