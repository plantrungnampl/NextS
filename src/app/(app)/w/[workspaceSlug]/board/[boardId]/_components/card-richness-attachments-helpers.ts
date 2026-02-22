import type { AttachmentRecord } from "../types";

export type AttachmentPreviewKind = "image" | "pdf" | "text" | "other";
export type AttachmentOpenKind = "external" | "internal";
export type AttachmentDomainBrand = "facebook" | "generic" | "instagram" | "linkedin" | "tiktok" | "x" | "youtube";

export function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAbsoluteTimestamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(date);

  return `${datePart} lúc ${timePart}`;
}

function formatRelativeTimestamp(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "vừa xong";
  }

  const relative = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });
  const units = [
    { max: 3_600_000, size: 60_000, unit: "minute" as const },
    { max: 86_400_000, size: 3_600_000, unit: "hour" as const },
    { max: 604_800_000, size: 86_400_000, unit: "day" as const },
    { max: 2_592_000_000, size: 604_800_000, unit: "week" as const },
  ];

  for (const entry of units) {
    if (diffMs < entry.max) {
      const value = Math.floor(diffMs / entry.size);
      return relative.format(-value, entry.unit);
    }
  }

  const months = Math.floor(diffMs / 2_592_000_000);
  if (months < 12) {
    return relative.format(-months, "month");
  }

  const years = Math.floor(months / 12);
  return relative.format(-years, "year");
}

export function formatAttachmentTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatRelativeTimestamp(date)} · ${formatAbsoluteTimestamp(date)}`;
}

export function resolveAttachmentPreviewKind(attachment: AttachmentRecord): AttachmentPreviewKind {
  if (attachment.sourceType === "url") {
    return "other";
  }

  const contentType = attachment.contentType ?? "";
  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType === "application/pdf") {
    return "pdf";
  }

  if (contentType.startsWith("text/")) {
    return "text";
  }

  return "other";
}

export function attachmentPreviewUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}`;
}

export function resolveAttachmentOpenUrl(attachment: AttachmentRecord): string {
  if (attachment.sourceType === "url" && attachment.externalUrl) {
    return attachment.externalUrl;
  }

  return attachmentPreviewUrl(attachment.id);
}

export function resolveAttachmentOpenKind(attachment: AttachmentRecord): AttachmentOpenKind {
  if (attachment.sourceType === "url" && attachment.externalUrl) {
    return "external";
  }

  return "internal";
}

export function resolveAttachmentHost(attachment: AttachmentRecord): string | null {
  if (attachment.sourceType !== "url" || !attachment.externalUrl) {
    return null;
  }

  try {
    return new URL(attachment.externalUrl).hostname;
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function hostMatches(host: string, target: string): boolean {
  return host === target || host.endsWith(`.${target}`);
}

export function resolveAttachmentDomainBrand(attachment: AttachmentRecord): AttachmentDomainBrand {
  const host = resolveAttachmentHost(attachment);
  if (!host) {
    return "generic";
  }

  const normalizedHost = normalizeHost(host);

  if (hostMatches(normalizedHost, "facebook.com") || hostMatches(normalizedHost, "fb.watch")) {
    return "facebook";
  }
  if (hostMatches(normalizedHost, "youtube.com") || hostMatches(normalizedHost, "youtu.be")) {
    return "youtube";
  }
  if (hostMatches(normalizedHost, "tiktok.com")) {
    return "tiktok";
  }
  if (hostMatches(normalizedHost, "x.com") || hostMatches(normalizedHost, "twitter.com")) {
    return "x";
  }
  if (hostMatches(normalizedHost, "instagram.com")) {
    return "instagram";
  }
  if (hostMatches(normalizedHost, "linkedin.com") || hostMatches(normalizedHost, "lnkd.in")) {
    return "linkedin";
  }

  return "generic";
}
