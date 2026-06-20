import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    alias: {
      "server-only": path.resolve(__dirname, "./src/lib/server-only-mock.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
