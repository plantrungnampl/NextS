import { requireAuthContext } from "@/lib/auth/server";
import { isPromise } from "@/shared";

import { parseSearchFilterStateFromParams } from "./search-filters";
import { loadSearchBootstrap } from "./search-service";
import { WorkspaceSearchClient } from "./workspace-search-client";

type SearchPageSearchParams = Record<string, string | string[] | undefined>;

type SearchPageProps = {
  searchParams?: SearchPageSearchParams | Promise<SearchPageSearchParams>;
};

async function resolveSearchParams(searchParams: SearchPageProps["searchParams"]): Promise<SearchPageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

function toUrlSearchParams(searchParams: SearchPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value[0] ?? "");
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

export default async function WorkspaceSearchPage({ searchParams }: SearchPageProps) {
  const { userId } = await requireAuthContext();
  const bootstrap = await loadSearchBootstrap(userId);
  const resolvedParams = await resolveSearchParams(searchParams);
  const initialState = parseSearchFilterStateFromParams(toUrlSearchParams(resolvedParams));

  return (
    <WorkspaceSearchClient
      bootstrap={bootstrap}
      initialState={initialState}
    />
  );
}
