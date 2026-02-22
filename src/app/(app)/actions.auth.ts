"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function signOut() {
  const supabase = await createServerSupabaseClient();

  try {
    await supabase.auth.signOut();
  } catch {
    // Fall through to redirect. Session may already be cleared.
  }

  revalidatePath("/", "layout");
  redirect(APP_ROUTES.login);
}
