import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run tests in a non-UTC time zone, so UTC-vs-local bugs fail the tests.
// Set here, not in the npm script: inline env vars don't work on Windows.
process.env.TZ = "Europe/Istanbul";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    env: { TZ: "Europe/Istanbul" },
    include: ["src/**/*.test.ts"],
  },
});
