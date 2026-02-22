import { createHash, randomBytes } from "node:crypto";

import { APP_ROUTES } from "@/core";

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 7;

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiryFromNow(now = new Date()): string {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + INVITE_TTL_DAYS);
  return expiry.toISOString();
}

export function isInviteExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function buildInviteLink(token: string): string {
  const invitePath = APP_ROUTES.inviteByToken(token);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return siteUrl ? `${siteUrl}${invitePath}` : invitePath;
}
