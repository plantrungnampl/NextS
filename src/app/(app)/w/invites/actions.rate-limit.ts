import "server-only";

import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function getInviteManageRetryAfterSeconds(params: {
  action: "create" | "resend" | "revoke";
  userId: string;
  workspaceId: string;
}): Promise<number | null> {
  const supabase = await createServerSupabaseClient();

  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.inviteManage,
      subjectParts: [
        `workspace:${params.workspaceId}`,
        `user:${params.userId}`,
        `action:${params.action}`,
      ],
      supabase,
    });
    return null;
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return error.retryAfterSeconds;
    }

    throw error;
  }
}
