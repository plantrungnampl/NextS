const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DANGEROUS_TAG_PATTERN = /<\s*\/?\s*(script|style|iframe|object|embed)[^>]*>/gi;

export function sanitizeUserText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS_PATTERN, "")
    .replace(DANGEROUS_TAG_PATTERN, "")
    .trim();
}

export function sanitizeNullableUserText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = sanitizeUserText(value);
  return sanitized.length > 0 ? sanitized : null;
}
