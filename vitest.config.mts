import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `import "server-only"` throws outside a React Server environment;
      // unit tests exercise that code directly, so stub it out.
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Most bugs friends hit are date bugs in a timezone the author isn't in,
    // so the suite runs in a zone well east of UTC by default (see
    // tests/unit/timezones.test.ts for the multi-zone sweep).
    env: { TZ: "Europe/Istanbul" },
  },
});
