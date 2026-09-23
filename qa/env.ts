import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Loads the repo's .env.local (scripts run from the repo root) into process.env for scripts that run outside Next (which does this itself). Never overrides a real env var. */
export function loadEnvLocal() {
  const file = join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
