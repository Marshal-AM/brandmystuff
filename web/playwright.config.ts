import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.ui\.ts/,
  timeout: 240_000,
  use: { baseURL: process.env.E2E_BASE ?? "http://localhost:3010", headless: true, trace: "retain-on-failure", screenshot: "only-on-failure" },
  reporter: [["list"]],
});
