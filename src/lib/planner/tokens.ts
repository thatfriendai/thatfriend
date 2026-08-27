import "server-only";
import { randomBytes } from "node:crypto";

/** URL-safe random token for invite/join links. */
export function generateToken() {
  return randomBytes(24).toString("base64url");
}
