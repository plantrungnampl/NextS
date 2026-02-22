import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { APP_ROUTES } from "@/core";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = searchParams.get("next") ?? APP_ROUTES.workspace.index;
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = APP_ROUTES.login;
  redirectUrl.searchParams.delete("token_hash");
  redirectUrl.searchParams.delete("type");

  if (!tokenHash || !type) {
    redirectUrl.searchParams.set("message", "Invalid confirmation link.");
    redirectUrl.searchParams.set("type", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    redirectUrl.searchParams.set("message", error.message);
    redirectUrl.searchParams.set("type", "error");
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.pathname = nextPath;
  redirectUrl.searchParams.delete("message");
  redirectUrl.searchParams.delete("next");
  redirectUrl.searchParams.delete("type");
  return NextResponse.redirect(redirectUrl);
}
