import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { AppError } from "./app-error.util";
import { HttpStatus } from "./http-status.util";

const ALGORITHM = "aes-256-gcm";

export function encrypt(
	plaintext: string,
	keyHex: string,
): { ciphertext: string; iv: string } {
	const key = Buffer.from(keyHex, "hex");
	const iv = randomBytes(16);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	// Prepend authTag (16 bytes) to the encrypted payload, then base64-encode
	const ciphertext = Buffer.concat([authTag, encrypted]).toString("base64");
	return { ciphertext, iv: iv.toString("hex") };
}

export function decrypt(
	ciphertext: string,
	ivHex: string,
	keyHex: string,
): string {
	try {
		const key = Buffer.from(keyHex, "hex");
		const iv = Buffer.from(ivHex, "hex");
		const buf = Buffer.from(ciphertext, "base64");
		const authTag = buf.subarray(0, 16);
		const encrypted = buf.subarray(16);
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		return decipher.update(encrypted) + decipher.final("utf8");
	} catch {
		throw new AppError("Failed to decrypt content", HttpStatus.INTERNAL_SERVER_ERROR);
	}
}

export const encryptionUtil = { encrypt, decrypt };
