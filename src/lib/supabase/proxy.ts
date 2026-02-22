import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { APP_ROUTES, getSupabaseEnv } from "@/core";

const PROTECTED_PATH_PREFIXES = [APP_ROUTES.workspace.index];
const AUTH_PATH_PREFIXES = [APP_ROUTES.login, "/auth"];

function isPathPrefixed(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });

  return target;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { publishableKey, url } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isProtected = isPathPrefixed(pathname, PROTECTED_PATH_PREFIXES);
  const isAuthPage = isPathPrefixed(pathname, AUTH_PATH_PREFIXES);

  if (!isAuthenticated && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_ROUTES.login;
    redirectUrl.searchParams.set("next", pathname);

    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (isAuthenticated && pathname === APP_ROUTES.login) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_ROUTES.workspace.index;
    redirectUrl.searchParams.delete("next");

    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (isAuthenticated && isAuthPage && pathname !== APP_ROUTES.authConfirm) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_ROUTES.workspace.index;
    redirectUrl.searchParams.delete("next");

    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}
