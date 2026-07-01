import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Runs against the regular dev DB (prisma/dev.db) — this is a local,
  // single-developer tool, so a dedicated e2e database isn't worth the extra
  // migrate-before-test step yet. Revisit if e2e runs start fighting with
  // manual testing data.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
