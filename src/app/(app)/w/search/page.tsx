import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, Input } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getFirstQueryParamValue, isPromise } from "@/shared";

type SearchPageSearchParams = {
  q?: string | string[];
  workspace?: string | string[];
};

type SearchPageProps = {
  searchParams?: SearchPageSearchParams | Promise<SearchPageSearchParams>;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
};

type BoardRow = {
  description: string | null;
  id: string;
  name: string;
  workspace_id: string;
};

type CardRow = {
  board_id: string;
  description: string | null;
  id: string;
  list_id: string;
  title: string;
};

type SearchContext = {
  boardScopeRows: Array<{ id: string; name: string; workspace_id: string }>;
  scopedWorkspaceSlug?: string;
  workspaceById: Map<string, WorkspaceRow>;
  workspaceIds: string[];
  workspaces: WorkspaceRow[];
};

type SearchResults = {
  boardResults: BoardRow[];
  cardResults: CardRow[];
  listTitleById: Map<string, string>;
};

async function resolveSearchParams(
  searchParams: SearchPageProps["searchParams"],
): Promise<SearchPageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

async function loadSearchContext(
  userId: string,
  workspaceFilterSlug?: string,
): Promise<SearchContext> {
  const supabase = await createServerSupabaseClient();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  const workspaceIds = ((memberships ?? []) as { workspace_id: string }[]).map(
    (entry) => entry.workspace_id,
  );

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .in("id", workspaceIds)
    .order("name", { ascending: true });
  const typedWorkspaces = (workspaces ?? []) as WorkspaceRow[];
  const workspaceById = new Map(typedWorkspaces.map((workspace) => [workspace.id, workspace]));
  const workspaceBySlug = new Map(typedWorkspaces.map((workspace) => [workspace.slug, workspace]));
  const scopedWorkspace = workspaceFilterSlug ? workspaceBySlug.get(workspaceFilterSlug) : undefined;

  const boardScopeQuery = supabase
    .from("boards")
    .select("id, workspace_id, name")
    .is("archived_at", null);
  if (scopedWorkspace) {
    boardScopeQuery.eq("workspace_id", scopedWorkspace.id);
  } else {
    boardScopeQuery.in("workspace_id", workspaceIds);
  }

  const { data: boardScopeRows } = await boardScopeQuery;

  return {
    boardScopeRows: (boardScopeRows ?? []) as Array<{ id: string; name: string; workspace_id: string }>,
    scopedWorkspaceSlug: scopedWorkspace?.slug,
    workspaceById,
    workspaceIds,
    workspaces: typedWorkspaces,
  };
}

async function searchWorkspaceContent(
  queryText: string,
  context: SearchContext,
): Promise<SearchResults> {
  if (queryText.length === 0) {
    return {
      boardResults: [],
      cardResults: [],
      listTitleById: new Map(),
    };
  }

  const supabase = await createServerSupabaseClient();
  const scopedWorkspaceId = context.scopedWorkspaceSlug
    ? context.workspaces.find((workspace) => workspace.slug === context.scopedWorkspaceSlug)?.id
    : undefined;
  const boardScopeIds = context.boardScopeRows.map((entry) => entry.id);

  const boardSearchQuery = supabase
    .from("boards")
    .select("id, workspace_id, name, description")
    .is("archived_at", null)
    .textSearch("search_vector", queryText, { config: "simple", type: "websearch" })
    .limit(30);
  if (scopedWorkspaceId) {
    boardSearchQuery.eq("workspace_id", scopedWorkspaceId);
  } else {
    boardSearchQuery.in("workspace_id", context.workspaceIds);
  }

  const cardSearchQuery = supabase
    .from("cards")
    .select("id, board_id, list_id, title, description")
    .is("archived_at", null)
    .textSearch("search_vector", queryText, { config: "simple", type: "websearch" })
    .limit(40);
  if (boardScopeIds.length > 0) {
    cardSearchQuery.in("board_id", boardScopeIds);
  } else {
    cardSearchQuery.in("board_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const [{ data: boards }, { data: cards }] = await Promise.all([
    boardSearchQuery,
    cardSearchQuery,
  ]);
  const boardResults = (boards ?? []) as BoardRow[];
  const cardResults = (cards ?? []) as CardRow[];

  const listIds = Array.from(new Set(cardResults.map((entry) => entry.list_id)));
  if (listIds.length === 0) {
    return {
      boardResults,
      cardResults,
      listTitleById: new Map(),
    };
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title")
    .in("id", listIds);
  const listTitleById = new Map(
    ((lists ?? []) as Array<{ id: string; title: string }>).map((entry) => [entry.id, entry.title]),
  );

  return {
    boardResults,
    cardResults,
    listTitleById,
  };
}

function SearchHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-lg font-semibold">Workspace search</h1>
        <p className="text-sm text-slate-400">Search boards and cards with full text search.</p>
      </div>
      <Link
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
        href={APP_ROUTES.workspace.index}
      >
        Back to workspace
      </Link>
    </header>
  );
}

function SearchForm({
  queryText,
  scopedWorkspaceSlug,
  workspaces,
}: {
  queryText: string;
  scopedWorkspaceSlug?: string;
  workspaces: WorkspaceRow[];
}) {
  return (
    <form action={APP_ROUTES.workspace.search} className="grid gap-2 rounded-md border border-slate-700 bg-[#1b2029] p-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
      <Input
        className="border-slate-600 bg-[#0f1318] text-slate-100 placeholder:text-slate-500"
        defaultValue={queryText}
        name="q"
        placeholder="Search cards and boards..."
      />
      <select
        className="h-11 w-full rounded-md border border-slate-600 bg-[#0f1318] px-3 text-sm text-slate-100"
        defaultValue={scopedWorkspaceSlug ?? ""}
        name="workspace"
      >
        <option value="">All workspaces</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.slug}>
            {workspace.name}
          </option>
        ))}
      </select>
      <Button className="min-h-11" type="submit">
        Search
      </Button>
    </form>
  );
}

function BoardResults({
  boardResults,
  workspaceById,
}: {
  boardResults: BoardRow[];
  workspaceById: Map<string, WorkspaceRow>;
}) {
  return (
    <section className="space-y-2 rounded-md border border-slate-700 bg-[#1b2029] p-3">
      <h2 className="text-sm font-semibold">Boards ({boardResults.length})</h2>
      {boardResults.length > 0 ? (
        boardResults.map((board) => {
          const workspace = workspaceById.get(board.workspace_id);
          if (!workspace) {
            return null;
          }

          return (
            <Link
              className="block rounded-md border border-slate-700 bg-[#0f1318] px-3 py-2 hover:border-sky-500/70"
              href={APP_ROUTES.workspace.boardById(workspace.slug, board.id)}
              key={board.id}
            >
              <p className="text-sm font-semibold text-slate-100">{board.name}</p>
              <p className="text-xs text-slate-400">
                {workspace.name} ({workspace.slug})
              </p>
              {board.description ? (
                <p className="mt-1 text-xs text-slate-300">{board.description}</p>
              ) : null}
            </Link>
          );
        })
      ) : (
        <p className="text-xs text-slate-400">No board matched this query.</p>
      )}
    </section>
  );
}

function CardResults({
  boardScopeRows,
  cardResults,
  listTitleById,
  workspaceById,
}: {
  boardScopeRows: Array<{ id: string; name: string; workspace_id: string }>;
  cardResults: CardRow[];
  listTitleById: Map<string, string>;
  workspaceById: Map<string, WorkspaceRow>;
}) {
  const boardById = new Map(boardScopeRows.map((entry) => [entry.id, entry]));

  return (
    <section className="space-y-2 rounded-md border border-slate-700 bg-[#1b2029] p-3">
      <h2 className="text-sm font-semibold">Cards ({cardResults.length})</h2>
      {cardResults.length > 0 ? (
        cardResults.map((card) => {
          const board = boardById.get(card.board_id);
          const workspace = board ? workspaceById.get(board.workspace_id) : undefined;
          if (!board || !workspace) {
            return null;
          }

          return (
            <Link
              className="block rounded-md border border-slate-700 bg-[#0f1318] px-3 py-2 hover:border-sky-500/70"
              href={APP_ROUTES.workspace.boardById(workspace.slug, board.id)}
              key={card.id}
            >
              <p className="text-sm font-semibold text-slate-100">{card.title}</p>
              <p className="text-xs text-slate-400">
                {board.name} • {listTitleById.get(card.list_id) ?? "Unknown list"}
              </p>
              {card.description ? (
                <p className="mt-1 text-xs text-slate-300">{card.description}</p>
              ) : null}
            </Link>
          );
        })
      ) : (
        <p className="text-xs text-slate-400">No card matched this query.</p>
      )}
    </section>
  );
}

export default async function WorkspaceSearchPage({ searchParams }: SearchPageProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const queryText = (getFirstQueryParamValue(resolvedSearchParams.q) ?? "").trim();
  const workspaceFilterSlug = getFirstQueryParamValue(resolvedSearchParams.workspace);
  const context = await loadSearchContext(user.id, workspaceFilterSlug);
  const results = await searchWorkspaceContent(queryText, context);

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-[#161a23] p-4 text-slate-100">
      <SearchHeader />
      <SearchForm
        queryText={queryText}
        scopedWorkspaceSlug={context.scopedWorkspaceSlug}
        workspaces={context.workspaces}
      />

      {queryText.length === 0 ? (
        <p className="rounded-md border border-slate-700 bg-[#1b2029] px-3 py-2 text-sm text-slate-400">
          Enter a query to search cards and boards.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <BoardResults
            boardResults={results.boardResults}
            workspaceById={context.workspaceById}
          />
          <CardResults
            boardScopeRows={context.boardScopeRows}
            cardResults={results.cardResults}
            listTitleById={results.listTitleById}
            workspaceById={context.workspaceById}
          />
        </div>
      )}
    </section>
  );
}
