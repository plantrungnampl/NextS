"use server";
/* eslint-disable max-lines */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { createServerSupabaseClient } from "@/lib/supabase";

import {
  logBoardActivity,
  resolveBoardAccess,
} from "./actions.shared";
import {
  addAttachmentUrlSchema,
  ensureActiveCard,
  refreshLegacyAttachmentTitlesSchema,
  recentAttachmentLinksSchema,
  revalidateBoardPath,
} from "./actions.card-richness.shared";

type AttachmentMutationResult =
  | {
    attachment?: AddedAttachmentRow;
    ok: true;
    uploadedCount?: number;
  }
  | { error: string; ok: false };

type AddedAttachmentRow = {
  content_type: string | null;
  created_at: string;
  created_by: string;
  external_url: string | null;
  file_name: string;
  id: string;
  size_bytes: number;
  source_type: "file" | "url" | null;
  storage_path: string | null;
};

export type RecentAttachmentLinkRecord = {
  attachmentId: string;
  createdAt: string;
  title: string;
  url: string;
};

type RecentAttachmentLinksResult =
  | { links: RecentAttachmentLinkRecord[]; ok: true }
  | { error: string; ok: false };

type LegacyAttachmentTitleRefreshResult =
  | { ok: true; scannedCount: number; updatedCount: number }
  | { error: string; ok: false };

const LINK_METADATA_TIMEOUT_MS = 2500;
const LINK_METADATA_MAX_BYTES = 262_144;
const LINK_METADATA_MAX_REDIRECTS = 3;
const LINK_TITLE_MAX_LENGTH = 255;
const LINK_LEGACY_SCAN_MULTIPLIER = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "localhost",
  "::1",
]);

function resolveInlineErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function sanitizeInvisibleCharacters(value: string): string {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, LINK_TITLE_MAX_LENGTH);
}

function normalizeExternalUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, "");
}

function isPrivateIpv4(value: string): boolean {
  const octets = value.split(".").map((entry) => Number(entry));
  if (octets.length !== 4 || octets.some((entry) => Number.isNaN(entry) || entry < 0 || entry > 255)) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10 || first === 127) {
    return true;
  }
  if (first === 169 && second === 254) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }

  return false;
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe80:");
}

function isBlockedHost(value: string): boolean {
  const host = value.trim().replace(/\.$/, "").toLowerCase();
  if (host.length < 1) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }

  const version = isIP(host);
  if (version === 4) {
    return isPrivateIpv4(host);
  }
  if (version === 6) {
    return isPrivateIpv6(host);
  }

  return false;
}

async function resolvesToBlockedNetwork(hostname: string): Promise<boolean> {
  if (isBlockedHost(hostname)) {
    return true;
  }

  try {
    const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
    return resolved.some((entry) => isBlockedHost(entry.address));
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&#([0-9]+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null = attributePattern.exec(tag);
  while (match) {
    const key = (match[1] ?? "").toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (key.length > 0 && value.length > 0) {
      attributes[key] = decodeHtmlEntities(value);
    }
    match = attributePattern.exec(tag);
  }
  return attributes;
}

function extractMetadataTitle(html: string): string | null {
  const metaPattern = /<meta\s+[^>]*>/gi;
  let match: RegExpExecArray | null = metaPattern.exec(html);
  while (match) {
    const attributes = parseAttributes(match[0] ?? "");
    const property = (attributes.property ?? attributes.name ?? "").toLowerCase();
    const content = attributes.content ?? "";
    if (content.length > 0 && (property === "og:title" || property === "twitter:title")) {
      const normalized = normalizeTitle(content);
      if (normalized.length > 0) {
        return normalized;
      }
    }
    match = metaPattern.exec(html);
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const fallbackTitle = normalizeTitle(decodeHtmlEntities(titleMatch?.[1] ?? ""));
  return fallbackTitle.length > 0 ? fallbackTitle : null;
}

async function readResponseTextWithLimit(response: Response, limitBytes: number): Promise<string | null> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, limitBytes);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    totalBytes += value.byteLength;
    if (totalBytes > limitBytes) {
      const allowedBytes = Math.max(0, limitBytes - (totalBytes - value.byteLength));
      if (allowedBytes > 0) {
        chunks.push(value.subarray(0, allowedBytes));
      }
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

async function fetchMetadataTitle(externalUrl: string): Promise<string | null> {
  let nextUrl = externalUrl;
  for (let redirectCount = 0; redirectCount <= LINK_METADATA_MAX_REDIRECTS; redirectCount += 1) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(nextUrl);
    } catch {
      return null;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    if (await resolvesToBlockedNetwork(parsedUrl.hostname)) {
      return null;
    }

    let response: Response;
    try {
      response = await fetch(parsedUrl.toString(), {
        headers: {
          "accept": "text/html,application/xhtml+xml",
          "user-agent": "NextS-LinkPreview/1.0",
        },
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(LINK_METADATA_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return null;
      }
      nextUrl = new URL(location, parsedUrl).toString();
      continue;
    }

    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await readResponseTextWithLimit(response, LINK_METADATA_MAX_BYTES);
    if (!html || html.length < 1) {
      return null;
    }

    return extractMetadataTitle(html);
  }

  return null;
}

function resolveAttachmentUrlTitle(params: {
  displayText: string | undefined;
  externalUrl: string;
  metadataTitle?: string | null;
}): string {
  const displayText = (params.displayText ?? "").trim();
  if (displayText.length > 0) {
    return normalizeTitle(displayText);
  }

  const metadataTitle = normalizeTitle(params.metadataTitle ?? "");
  if (metadataTitle.length > 0) {
    return metadataTitle;
  }

  try {
    const parsed = new URL(params.externalUrl);
    const pathSuffix = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    const fallback = `${parsed.hostname}${pathSuffix}`.trim();
    if (fallback.length > 0) {
      return normalizeTitle(fallback);
    }
  } catch {
    // Fall through to URL fallback.
  }

  return normalizeTitle(params.externalUrl);
}

function isLikelyLegacyUrlTitle(params: { externalUrl: string; fileName: string }): boolean {
  const normalizedFileName = normalizeTitle(params.fileName).toLowerCase();
  if (normalizedFileName.length < 1) {
    return true;
  }
  if (normalizedFileName.startsWith("http://") || normalizedFileName.startsWith("https://")) {
    return true;
  }

  const normalizedExternalUrl = normalizeExternalUrl(params.externalUrl);
  if (!normalizedExternalUrl) {
    return false;
  }

  let host = "";
  let hostAndPath = "";
  try {
    const parsed = new URL(normalizedExternalUrl);
    host = parsed.hostname.toLowerCase();
    hostAndPath = normalizeTitle(`${parsed.hostname}${parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : ""}`).toLowerCase();
  } catch {
    return false;
  }

  const comparableUrl = normalizedExternalUrl.toLowerCase();
  const comparableUrlWithoutTrailingSlash = stripTrailingSlashes(comparableUrl);
  const comparableUrlWithoutProtocol = stripProtocol(comparableUrlWithoutTrailingSlash);
  const comparableFileName = stripTrailingSlashes(normalizedFileName);

  return normalizedFileName === host
    || normalizedFileName === hostAndPath
    || normalizedFileName === comparableUrl
    || comparableFileName === comparableUrlWithoutTrailingSlash
    || comparableFileName === comparableUrlWithoutProtocol;
}

export async function addAttachmentUrlInline(
  formData: FormData,
): Promise<AttachmentMutationResult> {
  const rawDisplayText = formData.get("displayText");
  const rawExternalUrl = formData.get("externalUrl");

  const parsed = addAttachmentUrlSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    displayText: typeof rawDisplayText === "string" ? sanitizeInvisibleCharacters(rawDisplayText) : rawDisplayText ?? undefined,
    externalUrl: typeof rawExternalUrl === "string" ? sanitizeInvisibleCharacters(rawExternalUrl) : rawExternalUrl,
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return {
      error: `Payload đính kèm liên kết không hợp lệ (${path}): ${issue?.message ?? "Giá trị không hợp lệ."}`,
      ok: false,
    };
  }

  const normalizedExternalUrl = normalizeExternalUrl(parsed.data.externalUrl);
  if (!normalizedExternalUrl) {
    return { error: "Attachment URL must use http or https.", ok: false };
  }

  const metadataTitle = await fetchMetadataTitle(normalizedExternalUrl);
  const fileName = resolveAttachmentUrlTitle({
    displayText: parsed.data.displayText,
    externalUrl: normalizedExternalUrl,
    metadataTitle,
  });

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);

    const { data: attachment, error: insertError } = await supabase
      .from("attachments")
      .insert({
        card_id: parsed.data.cardId,
        content_type: "text/uri-list",
        created_by: access.userId,
        external_url: normalizedExternalUrl,
        file_name: fileName,
        size_bytes: 0,
        source_type: "url",
        storage_path: null,
      })
      .select("id, file_name, content_type, size_bytes, created_by, created_at, source_type, external_url, storage_path")
      .single();

    if (!attachment || insertError) {
      return { error: insertError?.message ?? "Failed to attach link.", ok: false };
    }

    await logBoardActivity({
      action: "attachment.link.add",
      boardId: parsed.data.boardId,
      entityId: parsed.data.cardId,
      entityType: "card",
      metadata: {
        attachmentId: attachment.id,
        externalUrl: normalizedExternalUrl,
      },
      userId: access.userId,
      workspaceId: access.workspaceId,
    });

    revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    return {
      attachment: attachment as AddedAttachmentRow,
      ok: true,
    };
  } catch (error) {
    return {
      error: resolveInlineErrorMessage(error, "Failed to attach link."),
      ok: false,
    };
  }
}

export async function getRecentAttachmentLinksInline(
  formData: FormData,
): Promise<RecentAttachmentLinksResult> {
  const parsed = recentAttachmentLinksSchema.safeParse({
    boardId: formData.get("boardId"),
    limit: formData.get("limit") ?? undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid recent links payload.", ok: false };
  }

  try {
    const access = await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId, {
      requiredPermission: "read",
    });
    const supabase = await createServerSupabaseClient();

    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from("attachments")
      .select("id, card_id, file_name, external_url, created_at")
      .eq("created_by", access.userId)
      .eq("source_type", "url")
      .order("created_at", { ascending: false })
      .limit(200);
    if (attachmentsError) {
      return { error: attachmentsError.message, ok: false };
    }

    const attachments = (attachmentsData ?? []) as Array<{
      card_id: string;
      created_at: string;
      external_url: string | null;
      file_name: string;
      id: string;
    }>;
    if (attachments.length < 1) {
      return { links: [], ok: true };
    }

    const cardIds = Array.from(new Set(attachments.map((entry) => entry.card_id)));
    const { data: cardsData, error: cardsError } = await supabase
      .from("cards")
      .select("id, board_id")
      .in("id", cardIds)
      .is("archived_at", null);
    if (cardsError) {
      return { error: cardsError.message, ok: false };
    }

    const cards = (cardsData ?? []) as Array<{ board_id: string; id: string }>;
    if (cards.length < 1) {
      return { links: [], ok: true };
    }

    const boardIds = Array.from(new Set(cards.map((entry) => entry.board_id)));
    const { data: boardsData, error: boardsError } = await supabase
      .from("boards")
      .select("id, workspace_id")
      .in("id", boardIds)
      .eq("workspace_id", access.workspaceId)
      .is("archived_at", null);
    if (boardsError) {
      return { error: boardsError.message, ok: false };
    }

    const workspaceBoardIds = new Set(
      ((boardsData ?? []) as Array<{ id: string; workspace_id: string }>).map((entry) => entry.id),
    );
    const workspaceCardIds = new Set(
      cards.filter((entry) => workspaceBoardIds.has(entry.board_id)).map((entry) => entry.id),
    );

    const links: RecentAttachmentLinkRecord[] = [];
    const seenUrls = new Set<string>();
    for (const attachment of attachments) {
      if (!workspaceCardIds.has(attachment.card_id)) {
        continue;
      }

      const normalizedUrl = attachment.external_url
        ? normalizeExternalUrl(attachment.external_url)
        : null;
      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        continue;
      }

      seenUrls.add(normalizedUrl);
      links.push({
        attachmentId: attachment.id,
        createdAt: attachment.created_at,
        title: attachment.file_name,
        url: normalizedUrl,
      });

      if (links.length >= parsed.data.limit) {
        break;
      }
    }

    return { links, ok: true };
  } catch (error) {
    return {
      error: resolveInlineErrorMessage(error, "Failed to load recent links."),
      ok: false,
    };
  }
}

export async function refreshLegacyAttachmentTitlesInline(
  formData: FormData,
): Promise<LegacyAttachmentTitleRefreshResult> {
  const parsed = refreshLegacyAttachmentTitlesSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    limit: formData.get("limit") ?? undefined,
    workspaceSlug: formData.get("workspaceSlug"),
  });
  if (!parsed.success) {
    return { error: "Invalid legacy attachment refresh payload.", ok: false };
  }

  try {
    await resolveBoardAccess(parsed.data.workspaceSlug, parsed.data.boardId);
    const supabase = await createServerSupabaseClient();
    await ensureActiveCard(supabase, parsed.data.workspaceSlug, parsed.data.boardId, parsed.data.cardId);

    const refreshLimit = parsed.data.limit;
    const queryLimit = Math.min(50, refreshLimit * LINK_LEGACY_SCAN_MULTIPLIER);

    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from("attachments")
      .select("id, external_url, file_name")
      .eq("card_id", parsed.data.cardId)
      .eq("source_type", "url")
      .not("external_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(queryLimit);
    if (attachmentsError) {
      return { error: attachmentsError.message, ok: false };
    }

    const attachments = (attachmentsData ?? []) as Array<{
      external_url: string | null;
      file_name: string;
      id: string;
    }>;

    let scannedCount = 0;
    let updatedCount = 0;

    for (const attachment of attachments) {
      if (scannedCount >= refreshLimit) {
        break;
      }

      const normalizedExternalUrl = attachment.external_url
        ? normalizeExternalUrl(attachment.external_url)
        : null;
      if (!normalizedExternalUrl) {
        continue;
      }

      if (!isLikelyLegacyUrlTitle({ externalUrl: normalizedExternalUrl, fileName: attachment.file_name })) {
        continue;
      }

      scannedCount += 1;
      const metadataTitle = await fetchMetadataTitle(normalizedExternalUrl);
      const resolvedTitle = resolveAttachmentUrlTitle({
        displayText: undefined,
        externalUrl: normalizedExternalUrl,
        metadataTitle,
      });
      const normalizedCurrentTitle = normalizeTitle(attachment.file_name);
      if (resolvedTitle.length < 1 || resolvedTitle === normalizedCurrentTitle) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("attachments")
        .update({ file_name: resolvedTitle })
        .eq("id", attachment.id)
        .eq("card_id", parsed.data.cardId)
        .eq("source_type", "url");
      if (!updateError) {
        updatedCount += 1;
      }
    }

    if (updatedCount > 0) {
      revalidateBoardPath(parsed.data.workspaceSlug, parsed.data.boardId);
    }

    return {
      ok: true,
      scannedCount,
      updatedCount,
    };
  } catch (error) {
    return {
      error: resolveInlineErrorMessage(error, "Failed to refresh legacy attachment titles."),
      ok: false,
    };
  }
}
