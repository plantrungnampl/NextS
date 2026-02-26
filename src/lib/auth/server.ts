import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import { createServerSupabaseClient } from "@/lib/supabase";

export type AuthContext = {
  email: string | null;
  userId: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function getEmailFromSessionClaims(
  sessionClaims: Awaited<ReturnType<typeof auth>>["sessionClaims"],
): string | null {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  const claims = sessionClaims as Record<string, unknown>;
  const rawEmail = claims.email;
  if (typeof rawEmail === "string" && rawEmail.trim().length > 0) {
    return rawEmail.trim().toLowerCase();
  }

  return null;
}

function resolveFallbackDisplayName(params: {
  clerkDisplayName: string | null;
  email: string | null;
  userId: string;
}): string {
  if (params.clerkDisplayName) {
    return params.clerkDisplayName;
  }

  if (params.email) {
    const localPart = params.email.split("@")[0]?.trim();
    if (localPart) {
      return localPart.slice(0, 120);
    }
  }

  return `user-${params.userId.slice(0, 8)}`;
}

function isSupabaseClerkTokenError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("no suitable key")
    || normalized.includes("wrong key type")
    || normalized.includes("invalid jwt");
}

function isClerkIdentityLinkProfileUniqueError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("clerk_identity_links_profile_id_key")
    || (
      normalized.includes("clerk_identity_links") &&
      normalized.includes("profile_id") &&
      normalized.includes("duplicate key")
    );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown auth error.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createSupabaseTokenConfigError(): Error {
  return new Error(
    "Supabase rejected the Clerk token. Configure Clerk as a Third-Party Auth provider in Supabase for this project.",
  );
}

async function resolveDatabaseUserId(params: {
  email: string | null;
  supabase: SupabaseServerClient;
}): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await params.supabase.rpc("link_current_clerk_identity_by_email", {
      email_override: params.email,
    });

    if (error) {
      if (isSupabaseClerkTokenError(error.message)) {
        throw createSupabaseTokenConfigError();
      }

      if (attempt === 0 && isClerkIdentityLinkProfileUniqueError(error.message)) {
        console.warn("[auth][clerk-link-retry] transient identity-link conflict detected, retrying once.");
        await delay(40);
        continue;
      }

      throw new Error(`Failed to resolve authenticated profile id: ${error.message}`);
    }

    if (typeof data !== "string" || data.trim().length < 1) {
      throw new Error("Failed to resolve authenticated profile id.");
    }

    return data;
  }

  throw new Error("Failed to resolve authenticated profile id.");
}

async function ensureProfileSeed(params: {
  avatarUrl: string | null;
  displayName: string;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  try {
    const { error } = await params.supabase.from("profiles").upsert({
      avatar_url: params.avatarUrl,
      display_name: params.displayName.slice(0, 120),
      id: params.userId,
    }, {
      ignoreDuplicates: true,
      onConflict: "id",
    });

    if (error) {
      if (isSupabaseClerkTokenError(error.message)) {
        throw createSupabaseTokenConfigError();
      }

      console.warn(`[auth] profile seed skipped: ${error.message}`);
    }
  } catch (error) {
    const message = toErrorMessage(error);
    if (isSupabaseClerkTokenError(message)) {
      throw createSupabaseTokenConfigError();
    }

    console.warn(`[auth] profile seed skipped: ${message}`);
  }
}

export async function getOptionalAuthContext(): Promise<AuthContext | null> {
  const authState = await auth();
  if (!authState.userId) {
    return null;
  }

  const user = await currentUser();

  const claimedEmail = getEmailFromSessionClaims(authState.sessionClaims);
  const primaryEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? null;
  const email = claimedEmail ?? primaryEmail;
  const fullName = user?.fullName?.trim() || user?.username?.trim() || null;
  const avatarUrl = user?.imageUrl?.trim() ?? null;
  const supabase = await createServerSupabaseClient();
  const userId = await resolveDatabaseUserId({
    email,
    supabase,
  });

  await ensureProfileSeed({
    avatarUrl,
    displayName: resolveFallbackDisplayName({
      clerkDisplayName: fullName,
      email,
      userId,
    }),
    supabase,
    userId,
  });

  return {
    email,
    userId,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getOptionalAuthContext();
  if (!context) {
    throw new Error("UNAUTHORIZED");
  }

  return context;
}
