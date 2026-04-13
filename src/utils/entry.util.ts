import { decrypt } from "./encryption.util";
import type { Delta, EntryPayload } from "../types/entry.types";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

/** Decrypt AES-256-GCM ciphertext and parse the JSON payload */
export function decryptEntry(encryptedContent: string, iv: string): EntryPayload {
  const decrypted = decrypt(encryptedContent, iv, ENCRYPTION_KEY);
  return JSON.parse(decrypted) as EntryPayload;
}

/** Extract plain text from a Quill Delta (no decryption) */
export function extractPlainText(delta: Delta): string {
  return delta.ops
    .filter((op) => typeof op.insert === "string")
    .map((op) => op.insert as string)
    .join("")
    .trim();
}

/**
 * Decrypt entry ciphertext and extract plain text, prefixed with the title.
 * Used by the analysis pipeline to build the text sent to the AI service.
 */
export function decryptAndExtractText(encryptedContent: string, iv: string): string {
  const payload = decryptEntry(encryptedContent, iv);
  const contentText = extractPlainText(payload.content);
  const titlePrefix = payload.title ? `${payload.title}\n` : "";
  return `${titlePrefix}${contentText}`;
}
