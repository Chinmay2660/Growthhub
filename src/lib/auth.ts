import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";

const CODE_SALT_LEN = 16;
const DUMMY_SALT = Buffer.alloc(CODE_SALT_LEN);

/** A stored value no 6-digit code can ever match (no ":" separator, so verification always fails). */
export const UNUSABLE_AUTH_HASH = "disabled";

/** Seeded demo accounts. They are entered through "Try demo" only, never with a username and code. */
export function isReservedDemoUsername(username: string): boolean {
  return username === "guest_demo" || /^demo_member_\d+$/.test(username);
}

export function generateAuthCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Server-only (node crypto). Kept out of utils.ts so client bundles do not pull in crypto polyfills. */
export function generateJoinCode(): string {
  return generateAuthCode();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

export function isValidAuthCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function hashAuthCode(code: string): string {
  const salt = randomBytes(CODE_SALT_LEN);
  const hash = scryptSync(code, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyAuthCode(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const valid = Boolean(saltHex && hashHex);
  // Always do the same scrypt work, even for a malformed or unusable hash, so timing reveals nothing.
  const salt = valid ? Buffer.from(saltHex, "hex") : DUMMY_SALT;
  const expected = valid ? Buffer.from(hashHex, "hex") : Buffer.alloc(32);
  const actual = scryptSync(code, salt, 32);
  if (!valid || expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
