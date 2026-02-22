"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { hashInviteToken } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";

type AcceptInviteRpcResponse = {
  message?: string;
  status?: string;
  workspace_slug?: string;
};

const acceptInviteSchema = z.object({
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
  return `${APP_ROUTES.inviteByToken(token)}?${searchParams.toString()}`;
}

function withWorkspaceInviteMessage(workspaceSlug: string, message: string): string {
  const searchParams = new URLSearchParams({
    inviteMessage: message,
    inviteType: "success",
    workspace: workspaceSlug,
  });
  return `${APP_ROUTES.workspace.invites}?${searchParams.toString()}`;
}

function withLoginRedirect(token: string): string {
  const searchParams = new URLSearchParams({
    next: APP_ROUTES.inviteByToken(token),
  });
  return `${APP_ROUTES.login}?${searchParams.toString()}`;
}

export async function acceptInvite(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
  });

  if (!parsed.success) {
    redirect(APP_ROUTES.workspace.index);
  }

  const token = parsed.data.token;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(withLoginRedirect(token));
  }

  const tokenHash = hashInviteToken(token);
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.inviteAccept,
      subjectParts: [`token:${tokenHash}`, `user:${user.id}`],
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

  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    invite_token_hash: tokenHash,
  });

  if (error) {
    redirect(withInviteMessage(token, error.message, "error"));
  }

  const payload = (data ?? {}) as AcceptInviteRpcResponse;
  const status = payload.status;
  const message = payload.message ?? "Invite could not be processed.";

  if (status === "accepted" || status === "already_accepted" || status === "already_member") {
    const workspaceSlug = payload.workspace_slug;
    if (!workspaceSlug) {
      redirect(APP_ROUTES.workspace.index);
    }

    redirect(withWorkspaceInviteMessage(workspaceSlug, message));
  }

  redirect(withInviteMessage(token, message, "error"));
}
