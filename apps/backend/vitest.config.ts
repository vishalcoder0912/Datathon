import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.js"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "../../coverage/backend",
      include: [
        "src/services/ai-analyst/**/*.js",
        "src/routes/schema-trained-ai.routes.js",
        "src/routes/health.js"
      ]
    }
  }
});
