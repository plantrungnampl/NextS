"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  APP_ROUTES,
  sanitizeNullableUserText,
  sanitizeUserText,
} from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(3).max(120),
});
const createBoardSchema = z.object({
  workspaceSlug: z.string().trim().min(2).max(120),
  name: z.string().trim().min(1).max(160),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  visibility: z.enum(["workspace", "private", "public"]).default("workspace"),
});
const SUPABASE_REQUEST_TIMEOUT_MS = 10000;
type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseErrorLike = { code?: string; message: string };
type WorkspaceRecord = { id: string; slug: string };
type WorkspaceMembershipRecord = { role: string };
type BoardRecord = { id: string };

async function fetchAuthenticatedUser(): Promise<{ id: string } | null> {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    return null;
  }

  return { id: authContext.userId };
}

async function enforceWorkspaceMutationRateLimit(params: {
  action: string;
  onRateLimited: (retryAfterSeconds: number) => never;
  supabase: SupabaseClient;
  userId: string;
}): Promise<void> {
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.workspaceMutation,
      subjectParts: [`user:${params.userId}`, `action:${params.action}`],
      supabase: params.supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      params.onRateLimited(error.retryAfterSeconds);
    }
    throw error;
  }
}

async function fetchWorkspaceBySlug(
  supabase: SupabaseClient,
  workspaceSlug: string,
): Promise<{ data: WorkspaceRecord | null; error: SupabaseErrorLike | null }> {
  const response = await withTimeout(
    (async () =>
      await supabase
        .from("workspaces")
        .select("id, slug")
        .eq("slug", workspaceSlug)
        .maybeSingle())(),
    SUPABASE_REQUEST_TIMEOUT_MS,
    "Workspace lookup timed out. Please try again.",
  );

  return {
    data: (response.data as WorkspaceRecord | null) ?? null,
    error: response.error as SupabaseErrorLike | null,
  };
}

async function fetchWorkspaceMembership(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<{ error: SupabaseErrorLike | null; membership: WorkspaceMembershipRecord | null }> {
  const response = await withTimeout(
    (async () =>
      await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle())(),
    SUPABASE_REQUEST_TIMEOUT_MS,
    "Membership lookup timed out. Please try again.",
  );

  return {
    error: response.error as SupabaseErrorLike | null,
    membership: (response.data as WorkspaceMembershipRecord | null) ?? null,
  };
}

function canCreateBoardWithRole(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }

  return role === "owner" || role === "admin" || role === "member";
}

function mapCreateBoardInsertError(error: SupabaseErrorLike | null): string {
  if (!error) {
    return "Could not create board.";
  }

  const normalizedMessage = error.message.toLowerCase();
  if (
    error.code === "42501"
    || normalizedMessage.includes("row-level security policy")
    || normalizedMessage.includes("permission denied")
  ) {
    return "You do not have permission to create a board in this workspace.";
  }

  return error.message;
}

async function insertBoardRecord(params: {
  boardDescription: string | null;
  boardName: string;
  supabase: SupabaseClient;
  userId: string;
  visibility: "workspace" | "private" | "public";
  workspaceId: string;
}): Promise<{ data: BoardRecord | null; error: SupabaseErrorLike | null }> {
  const boardId = randomUUID();
  const response = await withTimeout(
    (async () =>
      await params.supabase
        .from("boards")
        .insert({
          id: boardId,
          created_by: params.userId,
          description: params.boardDescription,
          name: params.boardName,
          visibility: params.visibility,
          workspace_id: params.workspaceId,
        })
    )(),
    SUPABASE_REQUEST_TIMEOUT_MS,
    "Create board request timed out. Please try again.",
  );

  return {
    data: response.error ? null : { id: boardId },
    error: response.error as SupabaseErrorLike | null,
  };
}

async function finalizeBoardCreation(params: {
  board: BoardRecord;
  boardName: string;
  userId: string;
  visibility: "workspace" | "private" | "public";
  workspace: WorkspaceRecord;
}): Promise<never> {
  const supabase = await createServerSupabaseClient();
  const { error: activityError } = await supabase.from("activity_events").insert({
    action: "board.created",
    actor_id: params.userId,
    board_id: params.board.id,
    entity_id: params.board.id,
    entity_type: "board",
    metadata: {
      title: params.boardName,
      visibility: params.visibility,
    },
    workspace_id: params.workspace.id,
  });

  if (activityError) {
    console.error("[workspace] board activity insert failed", {
      boardId: params.board.id,
      workspaceId: params.workspace.id,
    });
  }
  revalidatePath(APP_ROUTES.workspace.index);
  redirect(APP_ROUTES.workspace.boardById(params.workspace.slug, params.board.id));
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug.length > 2 ? slug : `workspace-${Date.now().toString().slice(-6)}`;
}

function withStatusMessage(pathname: string, message: string): string {
  const searchParams = new URLSearchParams({
    message,
    type: "error",
  });

  return `${pathname}?${searchParams.toString()}`;
}

function withCreateBoardError(message: string, workspaceSlug?: string): string {
  const searchParams = new URLSearchParams({
    createBoard: "1",
    createBoardMessage: message,
    createBoardType: "error",
  });

  if (workspaceSlug) {
    searchParams.set("workspace", workspaceSlug);
  }

  return `${APP_ROUTES.workspace.index}?${searchParams.toString()}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirect(withStatusMessage(APP_ROUTES.workspace.index, "Workspace name must be 3-120 characters."));
  }

  const user = await fetchAuthenticatedUser();
  if (!user) {
    redirect(withStatusMessage(APP_ROUTES.login, "Please log in again."));
  }

  await enforceWorkspaceMutationRateLimit({
    action: "create-workspace",
    onRateLimited: (retryAfterSeconds) =>
      redirect(
        withStatusMessage(
          APP_ROUTES.workspace.index,
          `Too many workspace actions. Try again in ${retryAfterSeconds}s.`,
        ),
      ),
    supabase,
    userId: user.id,
  });

  const workspaceName = sanitizeUserText(parsed.data.name);
  if (workspaceName.length < 3) {
    redirect(withStatusMessage(APP_ROUTES.workspace.index, "Workspace name must be 3-120 characters."));
  }

  const baseSlug = slugify(workspaceName);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 9000) + 1000}`;
    let error: { code?: string; message: string } | null = null;

    try {
      const response = await withTimeout(
        (async () =>
          await supabase.from("workspaces").insert({
            created_by: user.id,
            name: workspaceName,
            slug,
          }))(),
        SUPABASE_REQUEST_TIMEOUT_MS,
        "Create workspace request timed out. Please try again.",
      );
      error = response.error;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Create workspace failed.";
      redirect(withStatusMessage(APP_ROUTES.workspace.index, message));
    }

    if (!error) {
      revalidatePath(APP_ROUTES.workspace.index);
      redirect(APP_ROUTES.workspace.boardsBySlug(slug));
    }

    if (error.code !== "23505") {
      redirect(withStatusMessage(APP_ROUTES.workspace.index, error.message));
    }
  }

  redirect(withStatusMessage(APP_ROUTES.workspace.index, "Could not create workspace. Try another name."));
}

export async function createBoard(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const rawWorkspaceSlug = formData.get("workspaceSlug");
  const fallbackWorkspaceSlug = typeof rawWorkspaceSlug === "string" ? rawWorkspaceSlug : undefined;

  const parsed = createBoardSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    name: formData.get("name"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
  });

  if (!parsed.success) {
    redirect(withCreateBoardError("Board title and workspace are required.", fallbackWorkspaceSlug));
  }

  const user = await fetchAuthenticatedUser();
  if (!user) {
    redirect(withStatusMessage(APP_ROUTES.login, "Please log in again."));
  }

  await enforceWorkspaceMutationRateLimit({
    action: "create-board",
    onRateLimited: (retryAfterSeconds) =>
      redirect(
        withCreateBoardError(
          `Too many board actions. Try again in ${retryAfterSeconds}s.`,
          parsed.data.workspaceSlug,
        ),
      ),
    supabase,
    userId: user.id,
  });

  const boardName = sanitizeUserText(parsed.data.name);
  if (boardName.length < 1) {
    redirect(withCreateBoardError("Board title and workspace are required.", parsed.data.workspaceSlug));
  }
  const boardDescription = sanitizeNullableUserText(parsed.data.description);

  const { data: workspace, error: workspaceError } = await fetchWorkspaceBySlug(
    supabase,
    parsed.data.workspaceSlug,
  );

  if (workspaceError || !workspace) {
    redirect(withCreateBoardError("Workspace not found.", parsed.data.workspaceSlug));
  }

  const { error: membershipError, membership } = await fetchWorkspaceMembership(
    supabase,
    workspace.id,
    user.id,
  );

  if (membershipError || !membership) {
    redirect(withCreateBoardError("You do not have access to this workspace.", parsed.data.workspaceSlug));
  }

  if (!canCreateBoardWithRole(membership.role)) {
    redirect(withCreateBoardError("You do not have permission to create a board in this workspace.", parsed.data.workspaceSlug));
  }

  const { data: board, error: boardError } = await insertBoardRecord({
    boardDescription,
    boardName,
    supabase,
    userId: user.id,
    visibility: parsed.data.visibility,
    workspaceId: workspace.id,
  });

  if (boardError || !board) {
    redirect(withCreateBoardError(mapCreateBoardInsertError(boardError ?? null), parsed.data.workspaceSlug));
  }

  await finalizeBoardCreation({
    board,
    boardName,
    userId: user.id,
    visibility: parsed.data.visibility,
    workspace,
  });
}
