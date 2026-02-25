"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { getOptionalAuthContext } from "@/lib/auth/server";
import { hashInviteToken } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";

type AcceptBoardInviteRpcResponse = {
  board_id?: string;
  message?: string;
  status?: string;
  workspace_slug?: string;
};

const acceptBoardInviteSchema = z.object({
  token: z.string().trim().min(16).max(255),
});

function withInviteMessage(
  token: string,
  message: string,
  type: "error" | "success",
): string {
  const searchParams = new URLSearchParams({
    message,
    type,
  });
  return `${APP_ROUTES.inviteBoardByToken(token)}?${searchParams.toString()}`;
}

function withBoardInviteSuccess(
  workspaceSlug: string,
  boardId: string,
  message: string,
): string {
  const searchParams = new URLSearchParams({
    message,
    type: "success",
  });

  return `${APP_ROUTES.workspace.boardById(workspaceSlug, boardId)}?${searchParams.toString()}`;
}

function withLoginRedirect(token: string): string {
  const searchParams = new URLSearchParams({
    next: APP_ROUTES.inviteBoardByToken(token),
  });
  return `${APP_ROUTES.login}?${searchParams.toString()}`;
}

export async function acceptBoardInvite(formData: FormData) {
  const authContext = await getOptionalAuthContext();
  const parsed = acceptBoardInviteSchema.safeParse({
    token: formData.get("token"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const token = parsed.data.token;
  const supabase = await createServerSupabaseClient();
  if (!authContext) {
    redirect(withLoginRedirect(token));
  }

  const tokenHash = hashInviteToken(token);

  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.inviteAccept,
      subjectParts: [`board-token:${tokenHash}`, `user:${authContext.userId}`],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      redirect(
        withInviteMessage(
          token,
          `Too many invite attempts. Try again in ${error.retryAfterSeconds}s.`,
          "error",
        ),
      );
    }

    throw error;
  }

  const { data, error } = await supabase.rpc("accept_board_invite", {
    invite_token_hash: tokenHash,
  });

  if (error) {
    redirect(withInviteMessage(token, error.message, "error"));
  }

  const payload = (data ?? {}) as AcceptBoardInviteRpcResponse;
  const status = payload.status;
  const message = payload.message ?? "Board invite could not be processed.";

  if (status === "accepted" || status === "already_accepted") {
    if (!payload.workspace_slug || !payload.board_id) {
      redirect(APP_ROUTES.workspace.index);
    }

    redirect(withBoardInviteSuccess(payload.workspace_slug, payload.board_id, message));
  }

  redirect(withInviteMessage(token, message, "error"));
}
