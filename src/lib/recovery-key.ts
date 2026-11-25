import { randomInt } from "crypto";
import { hashAuthCode, verifyAuthCode } from "@/lib/auth";

// No 0/O/1/I/L so a key read off paper can't be misread.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 4;
const GROUP_LEN = 4;

/** Plaintext key shown to the person, e.g. ABCD-EFGH-JKMN-PQRS. */
export function generateRecoveryKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let part = "";
    for (let i = 0; i < GROUP_LEN; i++) part += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(part);
  }
  return groups.join("-");
}

/** Strips spaces/dashes and uppercases. */
export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidRecoveryKeyShape(input: string): boolean {
  const k = normalizeRecoveryKey(input);
  return k.length === GROUPS * GROUP_LEN && [...k].every((c) => ALPHABET.includes(c));
}

export function hashRecoveryKey(key: string): string {
  return hashAuthCode(normalizeRecoveryKey(key));
}

export function verifyRecoveryKey(key: string, stored: string): boolean {
  return verifyAuthCode(normalizeRecoveryKey(key), stored);
}
