import { defineConfig, devices } from "@playwright/test";

const appRoot = "/Users/tony/projects/reading/app";
const e2eDbPath = `${appRoot}/data/reading-star.e2e.db`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],
  webServer: {
    command: `rm -f ${e2eDbPath} ${e2eDbPath}-shm ${e2eDbPath}-wal && READINGSTAR_DB_PATH=${e2eDbPath} READINGSTAR_DISABLE_SAMPLE_SEED=1 READINGSTAR_ENABLE_TEST_AUTH=1 npm --prefix ${appRoot} run build && READINGSTAR_DB_PATH=${e2eDbPath} READINGSTAR_DISABLE_SAMPLE_SEED=1 READINGSTAR_ENABLE_TEST_AUTH=1 npm --prefix ${appRoot} run start -- --port 3100`,
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180000,
  },
});
