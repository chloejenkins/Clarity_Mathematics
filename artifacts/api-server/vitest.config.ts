import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Route modules read env vars (UPLOADS_DIR, TUTOR_EMAILS) at import time.
    env: {
      UPLOADS_DIR: "/tmp/api-server-test-uploads",
    },
  },
});
