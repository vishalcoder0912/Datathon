import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts", "./src/__tests__/a11y/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Vitest defaults to one fork per available CPU. On local Windows setups
    // that can launch many isolated JSDOM workers at once and leave the full
    // suite waiting on worker startup. A small bounded pool keeps every test
    // enabled while making `npm run test:frontend` reproducible.
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4,
      },
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
