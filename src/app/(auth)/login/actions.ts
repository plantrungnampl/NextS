"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { APP_ROUTES } from "@/core";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  RateLimitExceededError,
} from "@/core/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase";

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  next: z.string().trim().optional(),
  password: z.string().trim().min(8).max(72),
});

function buildRedirectUrl(pathname: string, params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function resolveNextPath(rawNext: string | undefined): string {
  if (!rawNext || !rawNext.startsWith("/")) {
    return APP_ROUTES.workspace.index;
  }

  if (rawNext.startsWith("//")) {
    return APP_ROUTES.workspace.index;
  }

  return rawNext;
}

function readCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
    password: formData.get("password"),
  });
}

function rateLimitMessage(actionLabel: string, retryAfterSeconds: number): string {
  return `Too many ${actionLabel} attempts. Try again in ${retryAfterSeconds}s.`;
}

export async function login(formData: FormData) {
  const parsed = readCredentials(formData);
  const supabase = await createServerSupabaseClient();

  if (!parsed.success) {
    redirect(
      buildRedirectUrl(APP_ROUTES.login, {
        message: "Invalid email or password format.",
        type: "error",
      }),
    );
  }

  const { email, next, password } = parsed.data;
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.authLogin,
      subjectParts: [`email:${email}`],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      redirect(
        buildRedirectUrl(APP_ROUTES.login, {
          message: rateLimitMessage("login", error.retryAfterSeconds),
          next,
          type: "error",
        }),
      );
    }

    throw error;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      buildRedirectUrl(APP_ROUTES.login, {
        message: error.message,
        next,
        type: "error",
      }),
    );
  }

  redirect(resolveNextPath(next));
}

export async function signup(formData: FormData) {
  const parsed = readCredentials(formData);
  const supabase = await createServerSupabaseClient();

  if (!parsed.success) {
    redirect(
      buildRedirectUrl(APP_ROUTES.login, {
        message: "Invalid email or password format.",
        type: "error",
      }),
    );
  }

  const { email, next, password } = parsed.data;
  try {
    await enforceRateLimit({
      policy: RATE_LIMIT_POLICIES.authSignup,
      subjectParts: [`email:${email}`],
      supabase,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      redirect(
        buildRedirectUrl(APP_ROUTES.login, {
          message: rateLimitMessage("signup", error.retryAfterSeconds),
          next,
          type: "error",
        }),
      );
    }

    throw error;
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    options: {
      emailRedirectTo: `${origin}${APP_ROUTES.authConfirm}`,
    },
    password,
  });

  if (error) {
    redirect(
      buildRedirectUrl(APP_ROUTES.login, {
        message: error.message,
        next,
        type: "error",
      }),
    );
  }

  redirect(
    buildRedirectUrl(APP_ROUTES.login, {
      message: "Account created. Check your email to confirm your sign up.",
      next,
      type: "success",
    }),
  );
}
