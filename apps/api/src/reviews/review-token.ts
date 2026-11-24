import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url: 43 characters. */
export const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** A review link stays valid for 60 days after it is (re)sent. */
export const REVIEW_INVITATION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export function newReviewToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashReviewToken(token) };
}

/** Only this hash is stored, so a database leak does not leak working links. */
export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
