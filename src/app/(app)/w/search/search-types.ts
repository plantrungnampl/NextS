import type {
  SearchCardStatus,
  SearchDueBucket,
  SearchEntityType,
  SearchMatchMode,
} from "./search-filters";

export type SearchMemberOption = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
};

export type SearchLabelOption = {
  color: string;
  id: string;
  name: string;
};

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

export type SearchBootstrapPayload = {
  labelOptionsByWorkspaceSlug: Record<string, SearchLabelOption[]>;
  memberOptionsByWorkspaceSlug: Record<string, SearchMemberOption[]>;
  viewerId: string;
  workspaces: WorkspaceOption[];
};

export type SearchResultItem = {
  board?: { id: string; name: string };
  card?: { id: string; title: string };
  entityId: string;
  entityType: Exclude<SearchEntityType, "all">;
  href: string;
  id: string;
  score: number;
  snippet: string | null;
  title: string;
  updatedAt: string | null;
  workspace: WorkspaceOption;
};

export type SearchResponsePayload = {
  appliedFilters: {
    boardsHiddenByCardFilters: boolean;
    due: SearchDueBucket[];
    labels: string[];
    match: SearchMatchMode;
    members: string[];
    q: string;
    status: SearchCardStatus[];
    type: SearchEntityType;
    workspace: string;
  };
  items: SearchResultItem[];
  nextCursor: string | null;
};
