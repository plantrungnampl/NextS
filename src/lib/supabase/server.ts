import { createServerClient } from "@supabase/ssr";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseEnv } from "@/core";
import { getClerkTokenForSupabase } from "@/lib/auth/clerk-token";

export async function createClient() {
  const { publishableKey, url } = getSupabaseEnv();
  const authState = await auth();
  let accessToken: string | null = null;
  try {
    accessToken = await getClerkTokenForSupabase(authState.getToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clerk token error.";
    throw new Error(`Failed to resolve Clerk token for Supabase: ${message}`);
  }

  return createServerClient(url, publishableKey, {
    global: {
      headers: accessToken
        ? {
          Authorization: `Bearer ${accessToken}`,
        }
        : {},
    },
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Clerk handles auth state, so Supabase auth cookie sync is intentionally disabled.
      },
    },
  });
}
