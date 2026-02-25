const REDIRECT_SENTINEL = "NEXT_REDIRECT";

function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const digest = "digest" in error ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest === "string" && digest.includes(REDIRECT_SENTINEL)) {
    return true;
  }

  return error instanceof Error && error.message.includes(REDIRECT_SENTINEL);
}

export function extractRedirectDigestMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const digest = "digest" in error ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest !== "string" || !digest.includes(REDIRECT_SENTINEL)) {
    return null;
  }

  const digestParts = digest.split(";").map((part) => part.trim()).filter((part) => part.length > 0);
  const redirectPath = digestParts.find((part) => part.includes("?message="));
  if (!redirectPath) {
    return null;
  }

  try {
    const parsedUrl = new URL(redirectPath, "http://localhost");
    const message = parsedUrl.searchParams.get("message")?.trim();
    return message && message.length > 0 ? message : null;
  } catch {
    return null;
  }
}

export function resolveInlineActionErrorMessage(error: unknown, fallback: string): string {
  const redirectDigestMessage = extractRedirectDigestMessage(error);
  if (redirectDigestMessage) {
    return redirectDigestMessage;
  }

  if (isRedirectError(error)) {
    return fallback;
  }

  if (error instanceof Error) {
    const trimmedMessage = error.message.trim();
    if (trimmedMessage.length > 0) {
      return trimmedMessage;
    }
  }

  return fallback;
}
