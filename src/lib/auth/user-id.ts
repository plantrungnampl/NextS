import "server-only";

import { createHash } from "node:crypto";

const CLERK_USER_UUID_NAMESPACE = "f7d4e7a2-53d4-4df8-9f5f-931af65d4c2d";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidToBytes(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "").toLowerCase();
  if (normalized.length !== 32) {
    throw new Error("Invalid UUID input.");
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function toDatabaseUserId(inputUserId: string): string {
  const normalized = inputUserId.trim();
  if (!normalized) {
    throw new Error("Empty auth user id.");
  }

  if (UUID_PATTERN.test(normalized)) {
    return normalized.toLowerCase();
  }

  const namespaceBytes = uuidToBytes(CLERK_USER_UUID_NAMESPACE);
  const payloadBytes = Buffer.from(normalized, "utf8");
  const hash = createHash("sha1")
    .update(Buffer.concat([Buffer.from(namespaceBytes), payloadBytes]))
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  return bytesToUuid(hash.subarray(0, 16));
}
