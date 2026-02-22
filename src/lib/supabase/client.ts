import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/core";

export function createClient() {
  const { publishableKey, url } = getSupabaseEnv();

  return createBrowserClient(url, publishableKey);
}
