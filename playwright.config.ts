import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start -- --port 3001",
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "e2e.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tennis-organizing-app-e2e",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:e2e",
    },
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://localhost:3001",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
