import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

type RateLimitPolicy = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

type RpcClient = {
  rpc: (
    fn: string,
    params: Record<string, string | number>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export const RATE_LIMIT_POLICIES = {
  authLogin: { bucket: "auth.login", limit: 10, windowSeconds: 60 },
  authSignup: { bucket: "auth.signup", limit: 5, windowSeconds: 600 },
  inviteAccept: { bucket: "invite.accept", limit: 20, windowSeconds: 600 },
  inviteManage: { bucket: "invite.manage", limit: 60, windowSeconds: 900 },
  workspaceMutation: { bucket: "workspace.mutation", limit: 90, windowSeconds: 900 },
  boardDnd: { bucket: "board.dnd", limit: 240, windowSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function hashSubject(rawSubject: string): string {
  return createHash("sha256").update(rawSubject).digest("hex");
}

function parseIpAddress(rawForwardedFor: string | null, rawRealIp: string | null): string {
  if (rawForwardedFor) {
    const first = rawForwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  if (rawRealIp && rawRealIp.trim().length > 0) {
    return rawRealIp.trim();
  }

  return "unknown-ip";
}

async function getRequestFingerprint(): Promise<string> {
  const requestHeaders = await headers();
  const ipAddress = parseIpAddress(
    requestHeaders.get("x-forwarded-for"),
    requestHeaders.get("x-real-ip"),
  );
  const userAgent = (requestHeaders.get("user-agent") ?? "unknown-ua").slice(0, 160);
  return `ip:${ipAddress}|ua:${userAgent}`;
}

function normalizeSubjectParts(subjectParts: ReadonlyArray<string | null | undefined>): string {
  return subjectParts
    .map((part) => (part ?? "").trim().toLowerCase())
    .filter((part) => part.length > 0)
    .join("|");
}

function normalizeRateLimitRow(data: unknown): RateLimitRow | null {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as RateLimitRow | null;
  }

  if (data && typeof data === "object") {
    return data as RateLimitRow;
  }

  return null;
}

function parseRetryAfterSeconds(row: RateLimitRow, fallbackWindowSeconds: number): number {
  const retryAfter =
    typeof row.retry_after_seconds === "number" && Number.isFinite(row.retry_after_seconds)
      ? Math.max(1, Math.floor(row.retry_after_seconds))
      : fallbackWindowSeconds;
  return retryAfter;
}

export async function enforceRateLimit(params: {
  policy: RateLimitPolicy;
  subjectParts: ReadonlyArray<string | null | undefined>;
  supabase: RpcClient;
}): Promise<void> {
  const fingerprint = await getRequestFingerprint();
  const normalizedSubject = normalizeSubjectParts([...params.subjectParts, fingerprint]);
  const subjectHash = hashSubject(normalizedSubject || `fallback|${fingerprint}`);

  const { data, error } = await params.supabase.rpc("consume_rate_limit", {
    p_bucket: params.policy.bucket,
    p_limit: params.policy.limit,
    p_subject_hash: subjectHash,
    p_window_seconds: params.policy.windowSeconds,
  });

  if (error) {
    throw new Error(`Rate limit RPC failed: ${error.message}`);
  }

  const row = normalizeRateLimitRow(data);
  if (!row) {
    throw new Error("Rate limit RPC returned an invalid payload.");
  }

  if (!row.allowed) {
    const retryAfterSeconds = parseRetryAfterSeconds(row, params.policy.windowSeconds);
    throw new RateLimitExceededError("Too many requests. Please slow down.", retryAfterSeconds);
  }
}
