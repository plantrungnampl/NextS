/* eslint-disable max-lines */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFromNow,
  normalizeInviteEmail,
} from "@/lib/invites";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

import { resolveInlineActionErrorMessage } from "./actions.inline-error";
import { boardRoute, logBoardActivity } from "./actions.shared";

export type BoardShareRole = "viewer" | "member" | "admin";

export type BoardShareMemberRecord = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  role: BoardShareRole;
};

export type BoardShareInviteRecord = {
  createdAt: string;
  expiresAt: string;
  id: string;
  invitedEmail: string;
  invitedRole: BoardShareRole;
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type BoardShareSnapshot = {
  boardId: string;
  boardLink: string;
  boardPath: string;
  canManage: boolean;
  members: BoardShareMemberRecord[];
  pendingInvites: BoardShareInviteRecord[];
};

type BoardShareMutationResult = {
  error?: string;
  ok: boolean;
};

type CreateBoardInviteMutationResult = BoardShareMutationResult & {
  inviteId?: string;
  inviteLink?: string;
};

type UpdateBoardMemberRoleMutationResult = BoardShareMutationResult & {
  role?: BoardShareRole;
  userId?: string;
};

type RemoveBoardMemberMutationResult = BoardShareMutationResult & {
  userId?: string;
};

const boardShareBaseSchema = z.object({
  boardId: z.string().uuid(),
  workspaceSlug: z.string().trim().min(2).max(120),
});

const boardShareInviteRoleSchema = z.enum([
  "viewer",
  "member",
  "admin",
]);

const createBoardInviteSchema = boardShareBaseSchema.extend({
  invitedEmail: z.email().trim().toLowerCase(),
  invitedRole: boardShareInviteRoleSchema,
});

const manageBoardInviteSchema = boardShareBaseSchema.extend({
  inviteId: z.string().uuid(),
});

const updateBoardMemberRoleSchema = boardShareBaseSchema.extend({
  nextRole: boardShareInviteRoleSchema,
  userId: z.string().trim().min(1).max(255),
});

const removeBoardMemberSchema = boardShareBaseSchema.extend({
  userId: z.string().trim().min(1).max(255),
});

function buildBoardInviteLink(token: string): string {
  const invitePath = APP_ROUTES.inviteBoardByToken(token);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return siteUrl ? `${siteUrl}${invitePath}` : invitePath;
}

async function getRateLimitError(params: {
  action: "create" | "revoke" | "resend";
  boardId: string;
  userId: string;
  workspaceId: string;
}) {
  const supabase = await createServerSupabaseClient();

  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.inviteManage,
      subjectParts: [
        `workspace:${params.workspaceId}`,
        `board:${params.boardId}`,
        `user:${params.userId}`,
        `action:${params.action}`,
      ],
      supabase,
    });
    return null;
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return `Too many invite actions. Try again in ${error.retryAfterSeconds}s.`;
    }

    throw error;
  }
}

type ResolvedBoardShareAccess = {
  canManage: boolean;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userEmail: string | null;
  userId: string;
  workspaceId: string;
};

async function resolveBoardShareAccess(params: {
  boardId: string;
  workspaceSlug: string;
}): Promise<ResolvedBoardShareAccess> {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    throw new Error("Authentication required.");
  }

  const supabase = await createServerSupabaseClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, workspace_id")
    .eq("id", params.boardId)
    .is("archived_at", null)
    .maybeSingle();

  if (boardError || !board) {
    throw new Error("Board not found or inaccessible.");
  }

  const typedBoard = board as { id: string; workspace_id: string };
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", typedBoard.workspace_id)
    .eq("slug", params.workspaceSlug)
    .maybeSingle();

  if (workspaceError || !workspace) {
    throw new Error("Workspace not found or inaccessible.");
  }

  const { data: canRead } = await supabase.rpc("can_read_board", {
    target_board_id: params.boardId,
  });

  if (!canRead) {
    throw new Error("Board not found or inaccessible.");
  }

  const { data: canManage } = await supabase.rpc("can_manage_board_access", {
    target_board_id: params.boardId,
  });

  return {
    canManage: Boolean(canManage),
    supabase,
    userEmail: authContext.email,
    userId: authContext.userId,
    workspaceId: typedBoard.workspace_id,
  };
}

function sanitizeShareRole(value: string | null): BoardShareRole {
  if (value === "viewer" || value === "member" || value === "admin") {
    return value;
  }

  return "member";
}

type BoardProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
};

type BoardMemberRow = {
  profile?: BoardProfileRow | null;
  role: string;
  user_id: string;
};

type BoardInviteRow = {
  created_at: string;
  expires_at: string;
  id: string;
  invited_email: string;
  invited_role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

function normalizeBoardMemberRow(row: BoardMemberRow): BoardShareMemberRecord {
  const profile = row.profile ?? null;
  return {
    avatarUrl: profile?.avatar_url ?? null,
    displayName: profile?.display_name?.trim() || `user-${row.user_id.slice(0, 8)}`,
    id: row.user_id,
    role: sanitizeShareRole(row.role),
  };
}

function normalizeBoardInviteRow(row: BoardInviteRow): BoardShareInviteRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    invitedEmail: row.invited_email,
    invitedRole: sanitizeShareRole(row.invited_role),
    status: row.status,
  };
}

export async function getBoardShareSnapshotInline(input: {
  boardId: string;
  workspaceSlug: string;
}): Promise<BoardShareSnapshot | null> {
  const parsed = boardShareBaseSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }

  try {
    const { canManage, supabase } = await resolveBoardShareAccess(parsed.data);

    const [
      { data: membersData, error: membersError },
      { data: pendingInvitesData, error: pendingInvitesError },
    ] = await Promise.all([
      supabase
        .from("board_members")
        .select("user_id, role")
        .eq("board_id", parsed.data.boardId)
        .order("created_at", { ascending: true }),
      supabase
        .from("board_invites")
        .select("id, invited_email, invited_role, status, created_at, expires_at")
        .eq("board_id", parsed.data.boardId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (membersError) {
      throw new Error(membersError.message);
    }

    if (pendingInvitesError) {
      throw new Error(pendingInvitesError.message);
    }

    const rawMembers = (membersData ?? []) as BoardMemberRow[];
    const memberIds = rawMembers.map((entry) => entry.user_id);
    let profileById = new Map<string, BoardProfileRow>();

    if (memberIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", memberIds);

      profileById = new Map(
        ((profilesData ?? []) as BoardProfileRow[]).map((entry) => [entry.id, entry]),
      );
    }

    const boardPath = boardRoute(parsed.data.workspaceSlug, parsed.data.boardId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
    const boardLink = siteUrl ? `${siteUrl}${boardPath}` : boardPath;

    return {
      boardId: parsed.data.boardId,
      boardLink,
      boardPath,
      canManage,
      members: rawMembers
        .map((entry) =>
          normalizeBoardMemberRow({
            ...entry,
            profile: profileById.get(entry.user_id) ?? null,
          }),
        )
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
      pendingInvites: ((pendingInvitesData ?? []) as BoardInviteRow[]).map(normalizeBoardInviteRow),
    };
  } catch {
    return null;
  }
}

// eslint-disable-next-line max-lines-per-function
export async function createBoardInviteInline(input: {
  boardId: string;
  invitedEmail: string;
  invitedRole: BoardShareRole;
  workspaceSlug: string;
}): Promise<CreateBoardInviteMutationResult> {
  const parsed = createBoardInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid invite payload.",
      ok: false,
    };
  }

  try {
    const { canManage, supabase, userEmail, userId, workspaceId } = await resolveBoardShareAccess(parsed.data);
    if (!canManage) {
      return {
        error: "Bạn không có quyền quản lý chia sẻ của bảng này.",
        ok: false,
      };
    }

    const rateLimitMessage = await getRateLimitError({
      action: "create",
      boardId: parsed.data.boardId,
      userId,
      workspaceId,
    });
    if (rateLimitMessage) {
      return {
        error: rateLimitMessage,
        ok: false,
      };
    }

    const invitedEmail = normalizeInviteEmail(parsed.data.invitedEmail);
    if (invitedEmail === normalizeInviteEmail(userEmail ?? "")) {
      return {
        error: "You cannot invite your own account.",
        ok: false,
      };
    }

    const { data: alreadyMember } = await supabase.rpc("board_has_member_email", {
      target_board_id: parsed.data.boardId,
      target_email: invitedEmail,
    });

    if (Boolean(alreadyMember)) {
      return {
        error: "This user is already a board member.",
        ok: false,
      };
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = inviteExpiryFromNow();

    const { data: existingInvite, error: existingInviteError } = await supabase
      .from("board_invites")
      .select("id")
      .eq("board_id", parsed.data.boardId)
      .eq("status", "pending")
      .ilike("invited_email", invitedEmail)
      .maybeSingle();

    if (existingInviteError) {
      return {
        error: existingInviteError.message,
        ok: false,
      };
    }

    let inviteId: string;
    if (existingInvite) {
      const { data: updatedInvite, error: updateError } = await supabase
        .from("board_invites")
        .update({
          expires_at: expiresAt,
          invited_by: userId,
          invited_email: invitedEmail,
          invited_role: parsed.data.invitedRole,
          token_hash: tokenHash,
        })
        .eq("id", (existingInvite as { id: string }).id)
        .select("id")
        .single();

      if (updateError || !updatedInvite) {
        return {
          error: updateError?.message ?? "Could not refresh pending invite.",
          ok: false,
        };
      }

      inviteId = (updatedInvite as { id: string }).id;
    } else {
      const { data: insertedInvite, error: insertError } = await supabase
        .from("board_invites")
        .insert({
          board_id: parsed.data.boardId,
          expires_at: expiresAt,
          invited_by: userId,
          invited_email: invitedEmail,
          invited_role: parsed.data.invitedRole,
          token_hash: tokenHash,
          workspace_id: workspaceId,
        })
        .select("id")
        .single();

      if (insertError || !insertedInvite) {
        return {
          error: insertError?.message ?? "Could not create board invite.",
          ok: false,
        };
      }

      inviteId = (insertedInvite as { id: string }).id;
    }

    await logBoardActivity({
      action: existingInvite ? "board.invite.updated" : "board.invite.created",
      boardId: parsed.data.boardId,
      entityId: inviteId,
      entityType: "member",
      metadata: {
        invitedEmail,
        invitedRole: parsed.data.invitedRole,
      },
      userId,
      workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return {
      inviteId,
      inviteLink: buildBoardInviteLink(rawToken),
      ok: true,
    };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Could not create board invite."),
      ok: false,
    };
  }
}

export async function resendBoardInviteInline(input: {
  boardId: string;
  inviteId: string;
  workspaceSlug: string;
}): Promise<CreateBoardInviteMutationResult> {
  const parsed = manageBoardInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid invite request.",
      ok: false,
    };
  }

  try {
    const { canManage, supabase, userId, workspaceId } = await resolveBoardShareAccess(parsed.data);
    if (!canManage) {
      return {
        error: "Bạn không có quyền quản lý chia sẻ của bảng này.",
        ok: false,
      };
    }

    const rateLimitMessage = await getRateLimitError({
      action: "resend",
      boardId: parsed.data.boardId,
      userId,
      workspaceId,
    });
    if (rateLimitMessage) {
      return {
        error: rateLimitMessage,
        ok: false,
      };
    }

    const { data: invite, error: inviteError } = await supabase
      .from("board_invites")
      .select("id, invited_email, status")
      .eq("board_id", parsed.data.boardId)
      .eq("id", parsed.data.inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      return {
        error: inviteError?.message ?? "Invite not found.",
        ok: false,
      };
    }

    if ((invite as { status: string }).status !== "pending") {
      return {
        error: "Only pending invites can be resent.",
        ok: false,
      };
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);

    const { error: updateError } = await supabase
      .from("board_invites")
      .update({
        expires_at: inviteExpiryFromNow(),
        invited_by: userId,
        token_hash: tokenHash,
      })
      .eq("id", parsed.data.inviteId)
      .eq("board_id", parsed.data.boardId)
      .eq("status", "pending");

    if (updateError) {
      return {
        error: updateError.message,
        ok: false,
      };
    }

    await logBoardActivity({
      action: "board.invite.resent",
      boardId: parsed.data.boardId,
      entityId: parsed.data.inviteId,
      entityType: "member",
      metadata: {
        invitedEmail: (invite as { invited_email: string }).invited_email,
      },
      userId,
      workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return {
      inviteId: parsed.data.inviteId,
      inviteLink: buildBoardInviteLink(rawToken),
      ok: true,
    };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Could not resend invite."),
      ok: false,
    };
  }
}

export async function revokeBoardInviteInline(input: {
  boardId: string;
  inviteId: string;
  workspaceSlug: string;
}): Promise<BoardShareMutationResult> {
  const parsed = manageBoardInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid invite request.",
      ok: false,
    };
  }

  try {
    const { canManage, supabase, userId, workspaceId } = await resolveBoardShareAccess(parsed.data);
    if (!canManage) {
      return {
        error: "Bạn không có quyền quản lý chia sẻ của bảng này.",
        ok: false,
      };
    }

    const rateLimitMessage = await getRateLimitError({
      action: "revoke",
      boardId: parsed.data.boardId,
      userId,
      workspaceId,
    });
    if (rateLimitMessage) {
      return {
        error: rateLimitMessage,
        ok: false,
      };
    }

    const { data: revokedInvite, error: revokeError } = await supabase
      .from("board_invites")
      .update({ status: "revoked" })
      .eq("id", parsed.data.inviteId)
      .eq("board_id", parsed.data.boardId)
      .eq("status", "pending")
      .select("id, invited_email")
      .maybeSingle();

    if (revokeError || !revokedInvite) {
      return {
        error: revokeError?.message ?? "Only pending invites can be revoked.",
        ok: false,
      };
    }

    await logBoardActivity({
      action: "board.invite.revoked",
      boardId: parsed.data.boardId,
      entityId: parsed.data.inviteId,
      entityType: "member",
      metadata: {
        invitedEmail: (revokedInvite as { invited_email: string }).invited_email,
      },
      userId,
      workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return { ok: true };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Could not revoke invite."),
      ok: false,
    };
  }
}

export async function updateBoardMemberRoleInline(input: {
  boardId: string;
  nextRole: BoardShareRole;
  userId: string;
  workspaceSlug: string;
}): Promise<UpdateBoardMemberRoleMutationResult> {
  const parsed = updateBoardMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid member role payload.",
      ok: false,
    };
  }

  try {
    const { canManage, supabase, userId, workspaceId } = await resolveBoardShareAccess(parsed.data);
    if (!canManage) {
      return {
        error: "Bạn không có quyền cập nhật quyền thành viên của bảng.",
        ok: false,
      };
    }

    const { data: boardRow } = await supabase
      .from("boards")
      .select("created_by")
      .eq("id", parsed.data.boardId)
      .maybeSingle();

    if ((boardRow as { created_by: string } | null)?.created_by === parsed.data.userId) {
      return {
        error: "Board creator role cannot be changed.",
        ok: false,
      };
    }

    const { data: memberRow, error: updateError } = await supabase
      .from("board_members")
      .update({ role: parsed.data.nextRole })
      .eq("board_id", parsed.data.boardId)
      .eq("user_id", parsed.data.userId)
      .select("user_id, role")
      .maybeSingle();

    if (updateError || !memberRow) {
      return {
        error: updateError?.message ?? "Board member not found.",
        ok: false,
      };
    }

    await logBoardActivity({
      action: "board.member.role.updated",
      boardId: parsed.data.boardId,
      entityId: parsed.data.userId,
      entityType: "member",
      metadata: {
        role: parsed.data.nextRole,
      },
      userId,
      workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return {
      ok: true,
      role: sanitizeShareRole((memberRow as { role: string }).role),
      userId: (memberRow as { user_id: string }).user_id,
    };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Could not update member role."),
      ok: false,
    };
  }
}

export async function removeBoardMemberInline(input: {
  boardId: string;
  userId: string;
  workspaceSlug: string;
}): Promise<RemoveBoardMemberMutationResult> {
  const parsed = removeBoardMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Invalid member payload.",
      ok: false,
    };
  }

  try {
    const { canManage, supabase, userId, workspaceId } = await resolveBoardShareAccess(parsed.data);
    if (!canManage) {
      return {
        error: "Bạn không có quyền xóa thành viên khỏi bảng.",
        ok: false,
      };
    }

    const { data: boardRow } = await supabase
      .from("boards")
      .select("created_by")
      .eq("id", parsed.data.boardId)
      .maybeSingle();

    if ((boardRow as { created_by: string } | null)?.created_by === parsed.data.userId) {
      return {
        error: "Board creator cannot be removed.",
        ok: false,
      };
    }

    const { data: removedRow, error: deleteError } = await supabase
      .from("board_members")
      .delete()
      .eq("board_id", parsed.data.boardId)
      .eq("user_id", parsed.data.userId)
      .select("user_id")
      .maybeSingle();

    if (deleteError || !removedRow) {
      return {
        error: deleteError?.message ?? "Board member not found.",
        ok: false,
      };
    }

    await logBoardActivity({
      action: "board.member.removed",
      boardId: parsed.data.boardId,
      entityId: parsed.data.userId,
      entityType: "member",
      metadata: {},
      userId,
      workspaceId,
    });

    revalidatePath(boardRoute(parsed.data.workspaceSlug, parsed.data.boardId));

    return {
      ok: true,
      userId: (removedRow as { user_id: string }).user_id,
    };
  } catch (error) {
    return {
      error: resolveInlineActionErrorMessage(error, "Could not remove board member."),
      ok: false,
    };
  }
}
